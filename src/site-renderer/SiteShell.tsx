import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import type { ThemeConfig } from '@/lib/design/theme';
import { BackgroundLayers } from './Background';
import type { OrderConfig } from './order/config';
import { env as appEnv } from '@/lib/env';
import { OrderProvider } from './order/OrderProvider';
import { SiteI18nProvider } from './SiteI18n';
import { siteTranslator } from './site-i18n';
import { SiteLang } from './SiteLang';
import styles from './site.module.css';
import { themeToVars } from './theme-vars';

type Props = {
  theme: ThemeConfig;
  language?: Locale;
  order?: OrderConfig | null;
  children: ReactNode;
  className?: string;
  /** "Sitio creado con …" (planes sin quitar la marca). */
  showBranding?: boolean;
  /** Sitio público: el <html lang> del documento pasa al idioma del negocio. */
  htmlLang?: boolean;
};

/** Raíz del sitio: variables del tema, fondo global, idioma del negocio y pedido por WhatsApp (si está activo). */
export function SiteShell({ theme, language = 'es', order, children, className, showBranding = false, htmlLang = false }: Props) {
  return (
    <>
      <div className={`${styles.root} ${className ?? ''}`} style={themeToVars(theme)} lang={language} data-site="">
        <BackgroundLayers background={theme.background} />
        <SiteI18nProvider language={language}>{order ? <OrderProvider config={order}>{children}</OrderProvider> : children}</SiteI18nProvider>
      </div>
      {/* Fuera de [data-site]: el CSS propio del negocio (limitado a ese selector) no puede ocultarlo. */}
      {showBranding && <SiteBranding language={language} />}
      {htmlLang && <SiteLang language={language} />}
    </>
  );
}

/** "Sitio creado con {app}": el enlace va donde está la variable (el orden cambia según el idioma). */
function SiteBranding({ language }: { language: Locale }) {
  const t = siteTranslator(language);
  const [before, after = ''] = t('Sitio creado con {app}').split('{app}');
  return (
    <p className={styles.branding} lang={language}>
      {before}
      <a href={appEnv.siteUrl} target="_blank" rel="noopener">{appEnv.appName}</a>
      {after}
    </p>
  );
}
