import 'server-only';

export type PdfImage = { data: Buffer; format: 'jpg' | 'png' };

const CONCURRENCY = 6;
const TIMEOUT_MS = 8000;

function detectFormat(buffer: Buffer): PdfImage['format'] | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
  return null; // WebP u otros: react-pdf no los soporta.
}

async function fetchImage(url: string): Promise<PdfImage | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    const format = detectFormat(data);
    return format ? { data, format } : null;
  } catch {
    return null;
  }
}

/**
 * Descarga imágenes con concurrencia limitada y timeout. Una imagen que
 * falla se omite (el PDF se genera igual): clave para catálogos grandes.
 */
export async function prefetchImages(urls: (string | null | undefined)[]): Promise<Map<string, PdfImage>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const result = new Map<string, PdfImage>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < unique.length) {
      const url = unique[cursor++];
      const image = await fetchImage(url);
      if (image) result.set(url, image);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
  return result;
}
