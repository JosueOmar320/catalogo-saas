import postcss from 'postcss';
import sanitize from 'sanitize-html';
import { MAX_CSS_LENGTH, MAX_HTML_LENGTH, SITE_SCOPE } from './custom-code-config';

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

const TEXT_TAGS = ['p', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'mark', 'sub', 'sup', 'br', 'hr', 'blockquote', 'q', 'cite', 'code', 'pre', 'kbd', 'abbr', 'time', 'address'];
const BLOCK_TAGS = ['div', 'section', 'article', 'aside', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'details', 'summary'];
const TABLE_TAGS = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'];
const MEDIA_TAGS = ['a', 'img', 'picture', 'source', 'video', 'audio'];

/** Propiedades de estilo en línea permitidas (sin position: nada puede tapar el sitio). */
const STYLE_PROPERTIES = [
  'color', 'background', 'background-color', 'opacity',
  'text-align', 'text-decoration', 'text-transform', 'font-size', 'font-weight', 'font-style', 'font-family', 'line-height', 'letter-spacing', 'white-space',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline', 'margin-block',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-inline', 'padding-block',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-width', 'border-style', 'border-radius',
  'display', 'gap', 'row-gap', 'column-gap', 'flex', 'flex-direction', 'flex-wrap', 'flex-basis', 'flex-grow', 'flex-shrink', 'justify-content', 'align-items', 'align-self', 'place-items',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'aspect-ratio', 'object-fit', 'overflow',
  'box-shadow', 'vertical-align', 'list-style', 'list-style-type',
];
/** Valores sin url(), expression(), escapes ni caracteres que permitan salir de la declaración. */
const SAFE_STYLE_VALUE = /^(?!.*(?:url\s*\(|image-set|expression|javascript:|-moz-binding|behavior|@import))[^<>;{}"\\]{1,300}$/i;

const HTML_OPTIONS: sanitize.IOptions = {
  allowedTags: [...TEXT_TAGS, ...BLOCK_TAGS, ...TABLE_TAGS, ...MEDIA_TAGS],
  allowedAttributes: {
    // Sin id (no debe chocar ni "pisar" elementos del sitio) ni on* (eventos).
    '*': ['class', 'style', 'title', 'lang', 'dir', 'role', 'aria-*', 'data-*'],
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
  allowedStyles: { '*': Object.fromEntries(STYLE_PROPERTIES.map((property) => [property, [SAFE_STYLE_VALUE]])) },
  transformTags: {
    // Enlaces a otra pestaña sin acceso a esta ventana.
    a: (tagName, attribs) => ({ tagName, attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener noreferrer' } : attribs }),
    img: (tagName, attribs) => ({ tagName, attribs: { loading: 'lazy', ...attribs } }),
  },
};

/** HTML seguro para mostrar dentro del sitio. */
export function sanitizeCustomHtml(html: string): string {
  return sanitize(html.slice(0, MAX_HTML_LENGTH), HTML_OPTIONS).trim();
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

const ALLOWED_AT_RULES = new Set(['media', 'supports', 'container', 'keyframes', '-webkit-keyframes', 'font-face', 'layer']);
const UNSAFE_CSS_VALUE = /expression\s*\(|javascript:|-moz-binding|behavior\s*:|image-set\s*\(|@import/i;
const URL_PATTERN = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

const isKeyframes = (node: postcss.Container | postcss.Document | undefined) => node?.type === 'atrule' && /keyframes$/i.test((node as postcss.AtRule).name);

/** `body`, `html` y `:root` se vuelven el sitio; lo demás queda dentro de él. */
function scopeSelector(selector: string, scope: string): string {
  const trimmed = selector.trim();
  const root = /^(html|body|:root)(?=$|[\s.#:[>+~])/i.exec(trimmed);
  if (root) return `${scope}${trimmed.slice(root[0].length).replace(/^\s*(html|body)(?=$|[\s.#:[>+~])/i, '')}`;
  return `${scope} ${trimmed}`;
}

/**
 * CSS del negocio limitado a su sitio. Si no se puede leer, no se aplica
 * nada (mejor sin estilos propios que con el sitio roto).
 */
export function scopeCustomCss(css: string, scope = SITE_SCOPE): string {
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
  });
  root.walkRules((rule) => {
    // Sólo las reglas de primer nivel (o dentro de @media…); las anidadas ya heredan el alcance.
    if (rule.parent?.type === 'rule' || isKeyframes(rule.parent)) return;
    rule.selectors = rule.selectors.map((selector) => scopeSelector(selector, scope));
  });
  // "<" nunca es necesario fuera de un texto, y escapado no puede cerrar la etiqueta <style>.
  return root.toString().replace(/</g, '\\3c ');
}

export { embedDocument } from './embed-document';
