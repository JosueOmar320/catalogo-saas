/**
 * Constantes del código propio sin dependencias (las usan los esquemas y el
 * navegador). La limpieza de HTML/CSS está en custom-code.ts (sólo donde se
 * muestra o se guarda).
 */
export const CUSTOM_CODE_SECTIONS = ['html', 'embed'] as const;
export type CustomCodeSection = (typeof CUSTOM_CODE_SECTIONS)[number];
export const isCustomCodeSection = (type: string): type is CustomCodeSection => (CUSTOM_CODE_SECTIONS as readonly string[]).includes(type);

export const MAX_HTML_LENGTH = 50_000;
export const MAX_CSS_LENGTH = 20_000;
/** Atributo de la raíz del sitio: el CSS propio queda limitado a ella. */
export const SITE_SCOPE = '[data-site]';

/** Servicios cuyo iframe se puede incluir en la sección HTML (videos, mapas, música, agenda). Para otros, «Widget con código». */
export const IFRAME_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'www.google.com', 'maps.google.com', 'open.spotify.com', 'w.soundcloud.com', 'calendly.com', 'docs.google.com'];

/** Lo que la limpieza quita del HTML propio (para avisarlo en el editor antes de publicar). */
export function removedByCleaning(html: string): ('scripts' | 'events' | 'forms' | 'iframes' | 'javascript' | 'fixed' | 'import')[] {
  const found: ReturnType<typeof removedByCleaning> = [];
  if (/<\s*script\b/i.test(html)) found.push('scripts');
  if (/\son[a-z]+\s*=/i.test(html)) found.push('events');
  const textInputs = [...html.matchAll(/<\s*input\b([^>]*)>/gi)].some((m) => !/\btype\s*=\s*["']?(checkbox|radio)\b/i.test(m[1]));
  if (/<\s*(form|select|textarea|object|embed)\b/i.test(html) || textInputs) found.push('forms');
  const iframes = [...html.matchAll(/<\s*iframe\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi)].map((m) => m[1]);
  if (/<\s*iframe\b/i.test(html) && (iframes.length === 0 || iframes.some((src) => { try { const url = new URL(src); return url.protocol !== 'https:' || !IFRAME_HOSTS.includes(url.hostname); } catch { return true; } }))) found.push('iframes');
  if (/javascript:/i.test(html)) found.push('javascript');
  if (/position\s*:\s*fixed/i.test(html)) found.push('fixed');
  if (/@import/i.test(html)) found.push('import');
  return found;
}

export const EMBED_MESSAGE = 'vitrina:embed-height';
/** Permisos del iframe: scripts y ventanas nuevas, NUNCA allow-same-origin ni allow-top-navigation. */
export const EMBED_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms';

export const clampEmbedHeight = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? Math.min(4000, Math.max(40, Math.round(value))) : null);
