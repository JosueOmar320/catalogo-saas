import postcss from 'postcss';
import sanitize from 'sanitize-html';
import { MAX_CSS_LENGTH, MAX_HTML_LENGTH, SITE_SCOPE } from './custom-code-config';
import { FX_CSS } from './fx';

export { clampEmbedHeight, EMBED_MESSAGE, EMBED_SANDBOX } from './custom-code-config';

/**
 * Código propio del negocio (lo habilita el administrador de la plataforma):
 *
 *  · Sección HTML: se limpia (sin scripts, eventos on*, iframes, formularios
 *    ni URLs javascript:) y se muestra dentro de la página, con los estilos
 *    del sitio. Se limpia al guardar Y al mostrar: los miembros también
 *    pueden escribir las páginas directo por la API (save_site).
 *  · Widget: HTML con scripts dentro de un iframe aislado (sandbox SIN
 *    allow-same-origin): corre en un origen opaco, sin acceso a la sesión,
 *    las cookies ni el panel, que comparten dominio con todos los sitios.
 *  · CSS del sitio: cada regla queda limitada al sitio ([data-site]), sin
 *    @import ni url() que no sea https.
 */

/* ------------------------------------------------------------ HTML */

const TEXT_TAGS = ['p', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'mark', 'sub', 'sup', 'br', 'wbr', 'hr', 'blockquote', 'q', 'cite', 'code', 'pre', 'kbd', 'samp', 'var', 'dfn', 'abbr', 'time', 'data', 'address', 'del', 'ins', 'bdi'];
const BLOCK_TAGS = ['div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'hgroup', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'details', 'summary'];
/** Controles sin formulario: un botón no envía nada (siempre type="button"). */
const CONTROL_TAGS = ['button', 'progress', 'meter'];
const TABLE_TAGS = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'];
const MEDIA_TAGS = ['a', 'img', 'picture', 'source', 'video', 'audio'];

/**
 * Propiedades de estilo en línea permitidas, además de las variables CSS
 * (--algo). Sin position: fixed (nada puede tapar el sitio).
 */
const STYLE_PROPERTIES = new Set([
  'color', 'background', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-clip', '-webkit-background-clip', '-webkit-text-fill-color', 'opacity',
  'text-align', 'text-decoration', 'text-transform', 'text-shadow', 'text-wrap', 'font-size', 'font-weight', 'font-style', 'font-family', 'font-variant-numeric', 'line-height', 'letter-spacing', 'white-space', 'word-break', 'overflow-wrap',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline', 'margin-block',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-inline', 'padding-block',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-width', 'border-style', 'border-radius', 'outline', 'outline-offset',
  'display', 'gap', 'row-gap', 'column-gap', 'flex', 'flex-direction', 'flex-wrap', 'flex-basis', 'flex-grow', 'flex-shrink', 'justify-content', 'justify-items', 'justify-self', 'align-items', 'align-self', 'align-content', 'place-items', 'place-content', 'order',
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-area', 'grid-column', 'grid-row',
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'aspect-ratio', 'object-fit', 'object-position', 'overflow', 'overflow-x', 'overflow-y',
  'position', 'top', 'right', 'bottom', 'left', 'inset', 'z-index', 'isolation',
  'box-shadow', 'filter', 'backdrop-filter', '-webkit-backdrop-filter', 'mix-blend-mode', 'clip-path',
  'transform', 'transform-origin', 'transform-style', 'perspective', 'transition', 'animation', 'animation-name', 'animation-duration', 'animation-delay', 'animation-iteration-count', 'animation-timing-function', 'animation-direction', 'animation-fill-mode',
  'vertical-align', 'list-style', 'list-style-type', 'cursor', 'pointer-events', 'visibility',
]);
/** Valores sin expression(), escapes ni caracteres que permitan salir de la declaración (url() se revisa aparte). */
const SAFE_STYLE_VALUE = /^(?!.*(?:image-set|expression|javascript:|-moz-binding|behavior|@import))[^<>;{}"\\]{1,400}$/i;
const STYLE_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

/** Estilo en línea limpio: propiedades permitidas y variables CSS, url() sólo https. */
export function cleanInlineStyle(style: string): string {
  let root: postcss.Root;
  try {
    root = postcss.parse(`x{${style.slice(0, 4000)}}`);
  } catch {
    return '';
  }
  const kept: string[] = [];
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    const value = decl.value.trim();
    if (!(STYLE_PROPERTIES.has(prop) || /^--[a-z0-9-]{1,40}$/i.test(prop)) || !SAFE_STYLE_VALUE.test(value)) return;
    if (prop === 'position' && !/^(static|relative|absolute|sticky)$/i.test(value)) return;
    const urls = [...value.matchAll(STYLE_URL)].map((m) => m[2]);
    if (/url\s*\(/i.test(value) && (urls.length === 0 || urls.some((url) => !/^https:\/\//i.test(url)))) return;
    kept.push(`${prop}:${value}${decl.important ? ' !important' : ''}`);
  });
  return kept.join(';');
}

const HTML_OPTIONS: sanitize.IOptions = {
  allowedTags: [...TEXT_TAGS, ...BLOCK_TAGS, ...TABLE_TAGS, ...MEDIA_TAGS, ...CONTROL_TAGS],
  allowedAttributes: {
    // Sin id (no debe chocar ni "pisar" elementos del sitio) ni on* (eventos).
    '*': ['class', 'style', 'title', 'lang', 'dir', 'role', 'tabindex', 'hidden', 'aria-*', 'data-*'],
    button: ['type', 'disabled'],
    progress: ['value', 'max'],
    meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
    data: ['value'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
    source: ['src', 'srcset', 'type', 'media'],
    video: ['src', 'poster', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'width', 'height', 'preload'],
    audio: ['src', 'controls', 'loop', 'muted', 'preload'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    col: ['span'],
    ol: ['start', 'reversed', 'type'],
    time: ['datetime'],
    details: ['open'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'], source: ['https'], video: ['https'], audio: ['https'] },
  allowProtocolRelative: false,
  // El estilo en línea se limpia con cleanInlineStyle (admite variables CSS: --progreso: 80%).
  parseStyleAttributes: false,
  transformTags: {
    // Enlaces a otra pestaña sin acceso a esta ventana.
    a: (tagName, attribs) => ({ tagName, attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener noreferrer' } : attribs }),
    img: (tagName, attribs) => ({ tagName, attribs: { loading: 'lazy', ...attribs } }),
    button: (tagName, attribs) => ({ tagName, attribs: { ...attribs, type: 'button' } }),
    '*': (tagName, attribs) => {
      const next = { ...attribs };
      if (next.style !== undefined) {
        const style = cleanInlineStyle(next.style);
        if (style) next.style = style;
        else delete next.style;
      }
      // Sólo 0 o -1: el orden del teclado lo decide el sitio.
      if (next.tabindex !== undefined) next.tabindex = next.tabindex === '-1' ? '-1' : '0';
      return { tagName, attribs: next };
    },
  },
};

/** HTML seguro para mostrar dentro del sitio (sin los bloques <style>: ver renderCustomHtml). */
export function sanitizeCustomHtml(html: string): string {
  return sanitize(html.slice(0, MAX_HTML_LENGTH), HTML_OPTIONS).trim();
}

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi;

/** Separa los bloques <style> del HTML (el CSS se limpia y se limita aparte). */
export function splitStyles(html: string): { markup: string; css: string } {
  const css: string[] = [];
  const markup = html.slice(0, MAX_HTML_LENGTH).replace(STYLE_BLOCK, (_, block: string) => {
    css.push(block);
    return '';
  });
  return { markup, css: css.join('\n').slice(0, MAX_CSS_LENGTH) };
}

/**
 * Lo que se guarda: el HTML limpio y su CSS limpio (sin limitar todavía:
 * al mostrarse se limita a su sección). El CSS que no se puede leer se descarta.
 */
export function cleanCustomHtmlSource(html: string): string {
  const { markup, css } = splitStyles(html);
  const clean = sanitizeCustomHtml(markup);
  const style = css.trim() ? cleanCustomCss(css) : '';
  return style ? `${clean}\n<style>\n${style}\n</style>` : clean;
}

/** Id de la sección HTML para su atributo data-custom-html (sólo letras, números, - y _). */
export const customHtmlId = (sectionId: string) => sectionId.replace(/[^a-zA-Z0-9_-]/g, '');
/** Selector de la sección HTML (el CSS de su <style> sólo alcanza a esa sección). */
export const customHtmlScope = (sectionId: string) => `[data-custom-html="${customHtmlId(sectionId)}"]`;

let fxCss: string | null = null;
/** Los efectos fx-… y data-fx, limitados a las secciones HTML. */
export function customHtmlFxCss(): string {
  fxCss ??= scopeCustomCss(FX_CSS, '[data-custom-html]');
  return fxCss;
}

/** Para mostrar: HTML limpio + su CSS limitado a la sección. */
export function renderCustomHtml(html: string, sectionId: string): { markup: string; css: string } {
  const { markup, css } = splitStyles(html);
  return { markup: sanitizeCustomHtml(markup), css: css.trim() ? scopeCustomCss(css, customHtmlScope(sectionId)) : '' };
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** Sólo el texto (para el PDF y para Garfield). */
export function htmlToText(html: string): string {
  return sanitize(html.slice(0, MAX_HTML_LENGTH).replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)\s*>|<br\s*\/?>/gi, '$&\n'), { allowedTags: [], allowedAttributes: {} })
    // Una sola pasada: "&amp;lt;" queda como el texto "&lt;" (no se decodifica dos veces).
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, entity: string) => ENTITIES[entity])
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/* ------------------------------------------------------------ CSS */

const ALLOWED_AT_RULES = new Set(['media', 'supports', 'container', 'keyframes', '-webkit-keyframes', 'font-face', 'layer', 'property']);
const UNSAFE_CSS_VALUE = /expression\s*\(|javascript:|-moz-binding|behavior\s*:|image-set\s*\(|@import/i;
const URL_PATTERN = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

const isKeyframes = (node: postcss.Container | postcss.Document | undefined) => node?.type === 'atrule' && /keyframes$/i.test((node as postcss.AtRule).name);

/** `body`, `html` y `:root` se vuelven el sitio; lo demás queda dentro de él. */
/**
 * Un selector que empieza con un combinador (`~ *`, `+ div`, `> p`) no se
 * puede limitar: "[data-site] ~ *" alcanza a los hermanos del sitio (fuera
 * de él). También se rechazan `&` y `|` por la misma razón.
 */
const ESCAPES_SCOPE = /^[>+~&|]/;

function scopeSelector(selector: string, scope: string): string | null {
  const trimmed = selector.trim();
  if (!trimmed || ESCAPES_SCOPE.test(trimmed)) return null;
  const root = /^(html|body|:root)(?=$|[\s.#:[>+~])/i.exec(trimmed);
  if (root) return `${scope}${trimmed.slice(root[0].length).replace(/^\s*(html|body)(?=$|[\s.#:[>+~])/i, '')}`;
  return `${scope} ${trimmed}`;
}

/**
 * CSS del negocio limitado a su sitio. Si no se puede leer, no se aplica
 * nada (mejor sin estilos propios que con el sitio roto).
 */
export function scopeCustomCss(css: string, scope = SITE_SCOPE): string {
  return processCss(css, scope);
}

/** CSS limpio sin limitar (para guardarlo; se limita al mostrarlo). */
export function cleanCustomCss(css: string): string {
  return processCss(css, null);
}

function processCss(css: string, scope: string | null): string {
  if (!css.trim()) return '';
  let root: postcss.Root;
  try {
    root = postcss.parse(css.slice(0, MAX_CSS_LENGTH));
  } catch {
    return '';
  }
  root.walkAtRules((rule) => {
    if (!ALLOWED_AT_RULES.has(rule.name.toLowerCase())) rule.remove();
  });
  root.walkDecls((decl) => {
    const urls = [...decl.value.matchAll(URL_PATTERN)].map((m) => m[2]);
    if (UNSAFE_CSS_VALUE.test(decl.value) || urls.some((url) => !/^https:\/\//i.test(url)) || (/url\s*\(/i.test(decl.value) && urls.length === 0)) decl.remove();
    // Igual que el estilo en línea: nada puede taparlo todo (la vista previa del panel comparte el documento).
    if (decl.prop.toLowerCase() === 'position' && /fixed/i.test(decl.value)) decl.remove();
  });
  if (scope !== null) {
    root.walkRules((rule) => {
      // Sólo las reglas de primer nivel (o dentro de @media…); las anidadas ya heredan el alcance.
      if (rule.parent?.type === 'rule' || isKeyframes(rule.parent)) return;
      const scoped = rule.selectors.map((selector) => scopeSelector(selector, scope)).filter((selector): selector is string => selector !== null);
      if (scoped.length === 0) rule.remove();
      else rule.selectors = scoped;
    });
  }
  // "<" nunca es necesario fuera de un texto, y escapado no puede cerrar la etiqueta <style>.
  return root.toString().replace(/</g, '\\3c ');
}

export { embedDocument } from './embed-document';
