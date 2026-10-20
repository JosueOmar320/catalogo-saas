import 'server-only';
import { FONTS, type FontId } from '@/lib/design/fonts';
import { readBodyCapped } from '@/lib/net/safe-fetch';

/**
 * Fuentes del sitio (regular y negrita) para las imágenes para compartir:
 * mismo origen y versión fija que el PDF (Fontsource). Si no se pueden bajar,
 * la imagen se genera igual con la fuente por defecto.
 */
const FONTSOURCE_VERSION = '5.3.0';
const TIMEOUT_MS = 5000;
const MAX_FONT_BYTES = 5 * 1024 * 1024;
const cache = new Map<string, Promise<ArrayBuffer | null>>();

function load(id: FontId, weight: 400 | 700): Promise<ArrayBuffer | null> {
  const key = `${id}-${weight}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const url = `https://cdn.jsdelivr.net/fontsource/fonts/${FONTS[id].fontsourceId}@${FONTSOURCE_VERSION}/latin-${weight}-normal.ttf`;
        const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'force-cache' });
        if (!response.ok) return null;
        const bytes = await readBodyCapped(response, MAX_FONT_BYTES);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      } catch {
        return null;
      }
    })();
    cache.set(key, pending);
    // Un fallo no se queda en caché: se reintenta la próxima vez.
    void pending.then((data) => data || cache.delete(key));
  }
  return pending;
}

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' };

/** Fuentes para ImageResponse: "heading" (títulos) y "body" (textos), cada una en 400 y 700. */
export async function ogFonts(heading: FontId, body: FontId): Promise<OgFont[]> {
  const specs = [
    { name: 'heading', id: heading, weight: 400 as const },
    { name: 'heading', id: heading, weight: 700 as const },
    { name: 'body', id: body, weight: 400 as const },
    { name: 'body', id: body, weight: 700 as const },
  ];
  const loaded = await Promise.all(specs.map(async (spec) => ({ ...spec, data: await load(spec.id, spec.weight) })));
  return loaded.flatMap((font) => (font.data ? [{ name: font.name, data: font.data, weight: font.weight, style: 'normal' as const }] : []));
}
