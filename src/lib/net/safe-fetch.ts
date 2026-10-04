import { lookup, type LookupAddress } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
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

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (version === 6) {
    const v6 = address.toLowerCase();
    if (v6.startsWith('::ffff:') && isIP(v6.slice(7)) === 4) return isPrivateAddress(v6.slice(7));
    return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff') || v6.startsWith('64:ff9b');
  }
  return true;
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
 * Descarga una imagen pública. `fetchImpl` sólo se reemplaza en pruebas; en
 * producción se usa `pinnedFetch` (verificación de IP al conectar).
 */
export async function safeDownload(raw: string, fetchImpl: typeof fetch = pinnedFetch, options: { maxBytes?: number; userAgent?: string } = {}): Promise<Downloaded> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const limitLabel = `${Math.round(maxBytes / 1024 / 1024)} MB`;
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
  if (!response || !response.ok || !response.body) throw new SafeFetchError('No se pudo descargar la imagen.');
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new SafeFetchError(`La imagen pesa más de ${limitLabel}.`);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError(`La imagen pesa más de ${limitLabel}.`);
    }
    chunks.push(value);
  }
  const data = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const type = sniffImage(data);
  if (!type) throw new SafeFetchError('El archivo no es una imagen (JPG, PNG, WebP, GIF o AVIF).');
  return { data, ...type, ...imageSize(data), finalUrl: url.toString() };
}
