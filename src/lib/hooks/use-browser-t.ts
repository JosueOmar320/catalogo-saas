'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from '@/i18n/config';
import { APP_EN } from '@/i18n/en';
import { createTranslator, type Translator } from '@/i18n/translate';

/** Mismo orden que el servidor: cookie elegida por el usuario → idioma del navegador → español. */
function browserLocale(): Locale {
  const cookie = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))?.[1];
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage(navigator.languages?.join(',') || navigator.language);
}

const subscribe = () => () => {};

/**
 * Traductor para las pantallas de error que se muestran FUERA del
 * I18nProvider (error.tsx y global-error.tsx raíz). En el servidor y al
 * hidratar usa español; después, el idioma del navegador.
 */
export function useBrowserT(): { locale: Locale; t: Translator } {
  const locale = useSyncExternalStore(subscribe, browserLocale, () => DEFAULT_LOCALE);
  return useMemo(() => ({ locale, t: createTranslator(locale, APP_EN) }), [locale]);
}
