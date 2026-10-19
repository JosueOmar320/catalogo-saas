import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from './config';
import { APP_EN } from './en';
import { createTranslator, type Translator } from './translate';

/**
 * Idioma de la app para esta petición: cookie elegida por el usuario →
 * Accept-Language del navegador → español. (Leer cookies vuelve dinámica la
 * página: no se usa en el sitio público, que tiene su propio idioma.)
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
});

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Guarda el idioma elegido en este navegador (sólo desde Server Actions o Route Handlers). */
export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
}

export async function getT(): Promise<Translator> {
  return createTranslator(await getLocale(), APP_EN);
}
