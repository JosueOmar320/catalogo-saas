/**
 * Revisión de calidad de una página que propuso el modelo: si quedó pobre
 * (pocas secciones, poco texto, sin imágenes, HTML muy simple) se le pide UNA
 * versión más completa. Puro: lo usa el proveedor y las pruebas.
 */
import { htmlToText, splitStyles } from '@/lib/site/custom-code';

type Plain = Record<string, unknown>;

/** Campos que son texto para el visitante (no ids, tipos, colores ni enlaces). */
const TEXT_KEYS = new Set(['eyebrow', 'title', 'subtitle', 'text', 'body', 'question', 'answer', 'label', 'quote', 'author', 'role', 'bio', 'description', 'caption', 'name', 'value', 'price', 'note']);

export const MIN_PAGE_SECTIONS = 6;
export const MIN_PAGE_WORDS = 300;
export const MIN_PAGE_IMAGES = 2;
/** Una sección html con menos que esto (sin contar el CSS) suele ser "un recuadro con un título". */
export const MIN_HTML_MARKUP = 700;

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** Texto visible del HTML propio (con el mismo parser que lo limpia; sin su CSS). */
const htmlText = (html: string) => htmlToText(splitStyles(html).markup);

function collect(value: unknown, key: string, acc: { words: number; images: number }) {
  if (typeof value === 'string') {
    if (key === 'html') acc.words += words(htmlText(value));
    else if (TEXT_KEYS.has(key)) acc.words += words(value);
    if (key === 'html') acc.images += (value.match(/media:|<img\b|<svg\b/gi) ?? []).length;
    return;
  }
  if (Array.isArray(value)) return value.forEach((item) => collect(item, key, acc));
  if (!value || typeof value !== 'object') return;
  const obj = value as Plain;
  if ('media' in obj || (typeof obj.path === 'string' && obj.path)) acc.images++;
  for (const [k, v] of Object.entries(obj)) collect(v, k, acc);
}

/** Medidas de las páginas nuevas de la respuesta. */
export function measurePages(actions: unknown[]): { title: string; sections: number; words: number; images: number; thinHtml: number }[] {
  return actions.flatMap((action) => {
    const a = action as Plain;
    if (a.action !== 'create_page' || !Array.isArray(a.sections)) return [];
    const acc = { words: 0, images: 0 };
    let thinHtml = 0;
    for (const section of a.sections as Plain[]) {
      collect({ content: section.content, style: section.style }, '', acc);
      const html = (section.content as Plain | undefined)?.html;
      if (section.type === 'html' && typeof html === 'string' && splitStyles(html).markup.length < MIN_HTML_MARKUP) thinHtml++;
    }
    return [{ title: String(a.title ?? ''), sections: a.sections.length, words: acc.words, images: acc.images, thinHtml }];
  });
}

/** Qué le falta a cada página nueva (vacío = está bien). */
export function pageCritique(actions: unknown[]): string[] {
  return measurePages(actions).flatMap((page) => {
    const issues: string[] = [];
    if (page.sections < MIN_PAGE_SECTIONS) issues.push(`tiene ${page.sections} secciones (usa ${MIN_PAGE_SECTIONS}–9 variadas)`);
    if (page.words < MIN_PAGE_WORDS) issues.push(`tiene ~${page.words} palabras de texto (escribe al menos 350: párrafos de 2–4 frases, listas, preguntas con respuestas completas)`);
    if (page.images < MIN_PAGE_IMAGES) issues.push(`tiene ${page.images} imágenes (pon al menos 3 con media {query})`);
    if (page.thinHtml) issues.push('su sección html es muy simple (hazla una pieza destacada: 3–6 elementos con contenido, SVG o íconos, degradados y efectos fx)');
    return issues.length ? [`La página «${page.title}» ${issues.join('; ')}.`] : [];
  });
}

/** Total de palabras de las páginas nuevas (para elegir la versión más completa). */
export const pageWords = (actions: unknown[]) => measurePages(actions).reduce((sum, page) => sum + page.words, 0);
