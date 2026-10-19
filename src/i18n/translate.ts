import type { Locale } from './config';

export type Catalog = Readonly<Record<string, string>>;
export type TranslateParams = Readonly<Record<string, string | number>>;
export type Translator = (source: string, params?: TranslateParams) => string;

/** Reemplaza {nombre} por su valor; las variables desconocidas quedan tal cual. */
export function interpolate(text: string, params?: TranslateParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

/**
 * Traductor para un idioma. En español devuelve el texto fuente; en inglés,
 * su traducción (o el español si faltara, para no mostrar nunca una clave).
 */
export function createTranslator(locale: Locale, catalog: Catalog | null): Translator {
  if (locale === 'es' || !catalog) return (source, params) => interpolate(source, params);
  return (source, params) => interpolate(catalog[source] ?? source, params);
}

/**
 * Marca un texto para el catálogo sin traducirlo todavía (gettext_noop): se
 * usa donde el texto se define lejos de donde se muestra (mensajes de Zod,
 * de Server Actions, etiquetas en constantes). Quien lo muestra llama a t().
 */
export const msg = <T extends string>(source: T): T => source;
