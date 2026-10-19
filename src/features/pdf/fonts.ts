import 'server-only';
import { Font } from '@react-pdf/renderer';
import { FONTS, type FontId } from '@/lib/design/fonts';
import { readBodyCapped } from '@/lib/net/safe-fetch';

const cache = new Map<FontId, Promise<boolean>>();
const TIMEOUT_MS = 5000;
/**
 * Versión fija de Fontsource (no "@latest"): el servidor interpreta estos
 * archivos, así que no se aceptan cambios del CDN sin revisarlos. Para
 * actualizar: `npm view @fontsource/inter version` y probar el PDF.
 */
const FONTSOURCE_VERSION = '5.3.0';
const MAX_FONT_BYTES = 5 * 1024 * 1024;

async function fetchBase64(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'force-cache' });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await readBodyCapped(response, MAX_FONT_BYTES)).toString('base64');
}

/**
 * Descarga la fuente (TTF 400 y 700 desde Fontsource) una vez por instancia
 * y la registra en react-pdf como data URL. Devuelve false si no se pudo.
 */
function ensureFont(id: FontId): Promise<boolean> {
  let pending = cache.get(id);
  if (!pending) {
    pending = (async () => {
      try {
        const base = `https://cdn.jsdelivr.net/fontsource/fonts/${FONTS[id].fontsourceId}@${FONTSOURCE_VERSION}/latin`;
        const [regular, bold] = await Promise.all([fetchBase64(`${base}-400-normal.ttf`), fetchBase64(`${base}-700-normal.ttf`)]);
        // Itálicas opcionales: algunas fuentes no las tienen (se usa la normal).
        const [italic, boldItalic] = await Promise.all([
          fetchBase64(`${base}-400-italic.ttf`).catch(() => regular),
          fetchBase64(`${base}-700-italic.ttf`).catch(() => bold),
        ]);
        const src = (data: string) => `data:font/ttf;base64,${data}`;
        Font.register({
          family: `pdf-${id}`,
          fonts: [
            { src: src(regular), fontWeight: 400 },
            { src: src(bold), fontWeight: 700 },
            { src: src(italic), fontWeight: 400, fontStyle: 'italic' },
            { src: src(boldItalic), fontWeight: 700, fontStyle: 'italic' },
          ],
        });
        return true;
      } catch (error) {
        console.warn(`[pdf] fuente ${id} no disponible, se usa Helvetica`, error);
        cache.delete(id);
        return false;
      }
    })();
    cache.set(id, pending);
  }
  return pending;
}

export async function resolvePdfFonts(ids: { heading: FontId; body: FontId; price: FontId }): Promise<{ heading: string; body: string; price: string }> {
  const [heading, body, price] = await Promise.all([ensureFont(ids.heading), ensureFont(ids.body), ensureFont(ids.price)]);
  return {
    heading: heading ? `pdf-${ids.heading}` : 'Helvetica',
    body: body ? `pdf-${ids.body}` : 'Helvetica',
    price: price ? `pdf-${ids.price}` : 'Helvetica',
  };
}

// Evita cortes de palabras con guiones automáticos (textos en español).
Font.registerHyphenationCallback((word) => [word]);
