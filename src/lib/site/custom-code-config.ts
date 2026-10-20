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

export const EMBED_MESSAGE = 'vitrina:embed-height';
/** Permisos del iframe: scripts y ventanas nuevas, NUNCA allow-same-origin ni allow-top-navigation. */
export const EMBED_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms';

export const clampEmbedHeight = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? Math.min(4000, Math.max(40, Math.round(value))) : null);
