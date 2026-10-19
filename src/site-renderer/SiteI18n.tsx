'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/translate';
import { siteTranslator } from './site-i18n';

const SiteI18nContext = createContext<{ language: Locale; t: Translator }>({ language: DEFAULT_LOCALE, t: siteTranslator(DEFAULT_LOCALE) });

/** Idioma del sitio para sus componentes cliente (buscador, filtros, menú…). */
export function SiteI18nProvider({ language, children }: { language: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ language, t: siteTranslator(language) }), [language]);
  return <SiteI18nContext.Provider value={value}>{children}</SiteI18nContext.Provider>;
}

export function useSiteT(): Translator {
  return useContext(SiteI18nContext).t;
}

export function useSiteLanguage(): Locale {
  return useContext(SiteI18nContext).language;
}
