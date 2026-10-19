import type { ReactNode } from 'react';
import { I18nProvider } from './client';
import { APP_EN } from './en';
import { getLocale } from './server';

/** Provee el idioma de la app a los componentes cliente (layouts del panel, admin, login, cuenta y landing). */
export async function AppI18n({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} catalog={locale === 'en' ? APP_EN : null}>
      {children}
    </I18nProvider>
  );
}
