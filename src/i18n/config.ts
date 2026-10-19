/**
 * Idiomas de la app. Estilo gettext: el texto en ESPAÑOL es la clave
 * (`t(textoEnEspañol)`) y los catálogos de `src/i18n/en/` lo traducen.
 * Si falta una traducción se muestra el español (nunca una clave cruda); la
 * prueba tests/i18n/catalog.test.ts verifica que no falte ninguna.
 *
 * Módulo sin 'use client' ni 'server-only': lo usan servidor y cliente.
 */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'locale';

export const LOCALE_LABELS: Record<Locale, string> = { es: 'Español', en: 'English' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Idioma preferido según Accept-Language ("en-US,en;q=0.9,es;q=0.8" → 'en'). */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q) || 0 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}
