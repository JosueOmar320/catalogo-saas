import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import type { ThemeConfig } from '@/lib/design/theme';
import { BackgroundLayers } from './Background';
import { SiteI18nProvider } from './SiteI18n';
import styles from './site.module.css';
import { themeToVars } from './theme-vars';

/** Raíz del sitio: variables del tema, fondo global e idioma del negocio. */
export function SiteShell({ theme, language = 'es', children, className }: { theme: ThemeConfig; language?: Locale; children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.root} ${className ?? ''}`} style={themeToVars(theme)} lang={language}>
      <BackgroundLayers background={theme.background} />
      <SiteI18nProvider language={language}>{children}</SiteI18nProvider>
    </div>
  );
}
