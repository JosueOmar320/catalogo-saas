import 'server-only';
import { toPdfImage } from '@/features/media/process';
import { readBodyCapped, safeDownload } from '@/lib/net/safe-fetch';

export type PdfImage = { data: Buffer; format: 'jpg' | 'png' };

const CONCURRENCY = 6;
const TIMEOUT_MS = 8000;

function detectFormat(buffer: Uint8Array): PdfImage['format'] | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
  return null;
}

/** Hosts propios o fijos (Storage del proyecto, demo, miniaturas de YouTube): descarga directa. */
function isTrustedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    const storage = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
    return host === storage || host === 'images.unsplash.com' || host === 'i.ytimg.com';
  } catch {
    return false;
  }
}

async function fetchImage(url: string): Promise<PdfImage | null> {
  try {
    let bytes: Uint8Array;
    if (isTrustedHost(url)) {
      // Host fijo, pero igual sin redirecciones (podrían llevar a otro host) y con tope de tamaño.
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) return null;
      bytes = await readBodyCapped(response);
    } else {
      // Imagen externa de la biblioteca: misma descarga segura que al agregarla (sin SSRF).
      bytes = (await safeDownload(url)).data;
    }
    const format = detectFormat(bytes);
    if (format) return { data: Buffer.from(bytes), format };
    // WebP, AVIF, GIF…: react-pdf no los soporta → se convierten.
    const converted = await toPdfImage(bytes);
    return converted ? { data: Buffer.from(converted.data), format: converted.extension } : null;
  } catch {
    return null;
  }
}

/**
 * Caché en memoria del proceso (LRU por tamaño + vencimiento). La vista previa
 * del estudio se regenera con cada cambio y antes volvía a descargar TODAS las
 * imágenes (≈45 % del tiempo de cada PDF). Las rutas propias son inmutables
 * (uuid; reemplazar crea una ruta nueva), así que reutilizarlas es seguro; las
 * URLs externas vencen a los 10 minutos. Sólo se guardan descargas exitosas.
 */
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { image: PdfImage; at: number }>();
let cacheBytes = 0;

function cacheGet(url: string): PdfImage | undefined {
  const hit = cache.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(url);
    cacheBytes -= hit.image.data.byteLength;
    return undefined;
  }
  // LRU: reinsertar la mueve al final.
  cache.delete(url);
  cache.set(url, hit);
  return hit.image;
}

function cacheSet(url: string, image: PdfImage) {
  const size = image.data.byteLength;
  if (size > CACHE_MAX_BYTES / 8) return;
  const previous = cache.get(url);
  if (previous) {
    cache.delete(url);
    cacheBytes -= previous.image.data.byteLength;
  }
  cache.set(url, { image, at: Date.now() });
  cacheBytes += size;
  for (const [key, entry] of cache) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    cache.delete(key);
    cacheBytes -= entry.image.data.byteLength;
  }
}

/**
 * Descarga imágenes con concurrencia limitada y timeout. Una imagen que
 * falla se omite (el PDF se genera igual): clave para catálogos grandes.
 */
export async function prefetchImages(urls: (string | null | undefined)[]): Promise<Map<string, PdfImage>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const result = new Map<string, PdfImage>();
  const pending: string[] = [];
  for (const url of unique) {
    const cached = cacheGet(url);
    if (cached) result.set(url, cached);
    else pending.push(url);
  }
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const url = pending[cursor++];
      const image = await fetchImage(url);
      if (image) {
        result.set(url, image);
        cacheSet(url, image);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  return result;
}
