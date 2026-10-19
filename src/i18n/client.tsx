'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './config';
import { createTranslator, type Catalog, type Translator } from './translate';

type I18nValue = { locale: Locale; t: Translator };

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: createTranslator(DEFAULT_LOCALE, null) });

/**
 * Idioma de la app en el cliente. El layout (servidor) resuelve el idioma y
 * pasa el catálogo sólo si no es español: quien usa la app en español no
 * descarga traducciones.
 */
export function I18nProvider({ locale, catalog, children }: { locale: Locale; catalog: Catalog | null; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale, catalog) }), [locale, catalog]);
  // El layout raíz es estático (lang="es"): se corrige aquí para lectores de pantalla y traductores.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
