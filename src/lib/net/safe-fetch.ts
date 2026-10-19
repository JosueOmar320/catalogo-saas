import { lookup, type LookupAddress } from 'node:dns';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { Readable } from 'node:stream';

/**
 * Descarga segura de imágenes de terceros (anti-SSRF). La usan la biblioteca
 * ("agregar desde URL"), Garfield (import_image) y el PDF (imágenes externas).
 *
 * - Sólo https, sin credenciales en la URL, puerto 443.
 * - El host debe resolver a IPs PÚBLICAS. La verificación se hace en el
 *   momento de conectar (lookup propio de https.request): no hay ventana entre
 *   "verificar" y "descargar" para un DNS que cambie de respuesta (rebinding).
 * - Redirecciones manuales, cada una re-verificada (máx. 4).
 * - Límite de tamaño leyendo el cuerpo por partes y bytes mágicos de imagen.
 */

export class SafeFetchError extends Error {}

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif';
export type Downloaded = { data: Uint8Array; mime: ImageMime; extension: string; width: number | null; height: number | null; finalUrl: string };

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Rangos no públicos (RFC 6890 y afines). Se usa `BlockList` de Node en vez de
 * comparar texto: así no importa cómo esté escrita la dirección.
 */
// Una lista por familia: BlockList compara las IPv4 también contra las reglas IPv6 (como IPv4-mapped).
const BLOCKED_V4 = new BlockList();
const BLOCKED_V6 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "esta red"
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local (metadatos de nubes: 169.254.169.254)
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24], // documentación
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3], // multicast y reservadas (224/4 + 240/4)
] as const) BLOCKED_V4.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 96], // no especificada, loopback e IPv4-compatible (obsoleta)
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64], // descarte
  ['2001::', 32], // Teredo: esconde una IPv4
  ['2001:db8::', 32], // documentación
  ['fc00::', 7], // ULA
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (obsoleta)
  ['ff00::', 8], // multicast
] as const) BLOCKED_V6.addSubnet(network, prefix, 'ipv6');

/** Los 16 bytes de una IPv6 válida (acepta "::" y una IPv4 al final). */
function ipv6Bytes(address: string): number[] {
  const [head, tail = null] = address.split('::');
  // Una IPv4 al final ("::ffff:1.2.3.4") ocupa dos grupos de 16 bits.
  const dotted = (g: string) => {
    const [a, b, c, d] = g.split('.').map(Number);
    return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
  };
  const groups = (part: string | null) => (part ? part.split(':') : []).flatMap((g) => (g.includes('.') ? dotted(g) : [g]));
  const left = groups(head);
  const right = groups(tail);
  const words = tail === null ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return words.flatMap((w) => {
    const n = parseInt(w, 16);
    return [n >> 8, n & 0xff];
  });
}

/** IPv4 escondida dentro de una IPv6 (mapped, compatible, 6to4 o NAT64), si la hay. */
function embeddedIpv4(bytes: number[]): string | null {
  const zeros = (from: number, to: number) => bytes.slice(from, to).every((b) => b === 0);
  const v4 = (at: number) => bytes.slice(at, at + 4).join('.');
  if (zeros(0, 10) && ((bytes[10] === 0xff && bytes[11] === 0xff) || (bytes[10] === 0 && bytes[11] === 0))) return v4(12);
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return v4(2); // 6to4 2002:AABB:CCDD::
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) return v4(12);
  return null;
}

/** true si la dirección NO es pública (o no es una IP válida). */
export function isPrivateAddress(raw: string): boolean {
  const address = raw.replace(/%.*$/, ''); // sin zona (fe80::1%eth0)
  const version = isIP(address);
  if (version === 4) return BLOCKED_V4.check(address, 'ipv4');
  if (version !== 6) return true;
  // IPv4-mapped/compatible, 6to4 y NAT64: decide la IPv4 que llevan dentro.
  const embedded = embeddedIpv4(ipv6Bytes(address.toLowerCase()));
  if (embedded) return isPrivateAddress(embedded);
  return BLOCKED_V6.check(address, 'ipv6');
}

/** Valida la forma de la URL (sin red). Las IP literales se verifican aquí; los nombres, al conectar. */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('La URL no es válida.');
  }
  if (url.protocol !== 'https:') throw new SafeFetchError('Sólo se aceptan URLs https.');
  if (url.username || url.password) throw new SafeFetchError('La URL no es válida.');
  if (url.port && url.port !== '443') throw new SafeFetchError('Esa dirección no está permitida.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new SafeFetchError('Esa dirección no está permitida.');
  if (isIP(host) && isPrivateAddress(host)) throw new SafeFetchError('Esa dirección no está permitida.');
  return url;
}

/** lookup que sólo entrega IPs públicas: se usa en la conexión misma. */
function publicLookup(hostname: string, options: object, callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error('blocked_address'), { code: 'EBLOCKED' }), '', 0);
    }
    if ((options as { all?: boolean }).all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

/** fetch mínimo (GET, sin seguir redirecciones) que conecta sólo a IPs públicas. */
export const pinnedFetch: typeof fetch = (input, init) =>
  new Promise<Response>((resolve, reject) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const req = request(url, { method: 'GET', headers, lookup: publicLookup as never, timeout: 15_000 }, (res) => {
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(res.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      const status = res.statusCode ?? 500;
      const body = status === 204 || status === 304 || (status >= 300 && status < 400) ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>);
      if (!body) res.resume();
      resolve(new Response(body, { status, headers: responseHeaders }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (error) => reject((error as NodeJS.ErrnoException).code === 'EBLOCKED' ? new SafeFetchError('Esa dirección no está permitida.') : error));
    init?.signal?.addEventListener('abort', () => req.destroy(new Error('aborted')));
    req.end();
  });

export function sniffImage(bytes: Uint8Array): { mime: ImageMime; extension: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: 'image/png', extension: 'png' };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  if (ascii(0, 4) === 'GIF8') return { mime: 'image/gif', extension: 'gif' };
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) return { mime: 'image/avif', extension: 'avif' };
  return null;
}

/** Ancho y alto sin librerías (PNG: IHDR · JPEG: marcador SOF · GIF: cabecera). */
export function imageSize(bytes: Uint8Array): { width: number | null; height: number | null } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x89 && bytes.length > 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] === 0x47 && bytes.length > 10) return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + length;
    }
  }
  return { width: null, height: null };
}

/**
 * Lee el cuerpo de una respuesta cortando al pasar `maxBytes` (no confía en
 * Content-Length: un servidor puede mentir o no enviarlo).
 */
export async function readBodyCapped(response: Response, maxBytes = DEFAULT_MAX_BYTES): Promise<Uint8Array> {
  const tooBig = () => new SafeFetchError(`La imagen pesa más de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  if (!response.body) throw new SafeFetchError('No se pudo descargar la imagen.');
  if (Number(response.headers.get('content-length') ?? 0) > maxBytes) throw tooBig();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooBig();
    }
    chunks.push(value);
  }
  const data = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

/**
 * Descarga una imagen pública. `fetchImpl` sólo se reemplaza en pruebas; en
 * producción se usa `pinnedFetch` (verificación de IP al conectar).
 */
export async function safeDownload(raw: string, fetchImpl: typeof fetch = pinnedFetch, options: { maxBytes?: number; userAgent?: string } = {}): Promise<Downloaded> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let url = assertPublicHttpsUrl(raw);
  let response: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    try {
      response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': options.userAgent ?? 'Mozilla/5.0 (compatible; catalog-builder)', Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' } });
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      throw new SafeFetchError('No se pudo descargar la imagen.');
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || hop === 4) throw new SafeFetchError('La URL redirige demasiadas veces.');
      url = assertPublicHttpsUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }
  if (!response || !response.ok) throw new SafeFetchError('No se pudo descargar la imagen.');
  const data = await readBodyCapped(response, maxBytes);
  const type = sniffImage(data);
  if (!type) throw new SafeFetchError('El archivo no es una imagen (JPG, PNG, WebP, GIF o AVIF).');
  return { data, ...type, ...imageSize(data), finalUrl: url.toString() };
}
