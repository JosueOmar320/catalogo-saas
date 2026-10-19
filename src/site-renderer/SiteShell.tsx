import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import type { ThemeConfig } from '@/lib/design/theme';
import { BackgroundLayers } from './Background';
import type { OrderConfig } from './order/config';
import { OrderProvider } from './order/OrderProvider';
import { SiteI18nProvider } from './SiteI18n';
import styles from './site.module.css';
import { themeToVars } from './theme-vars';

/** Raíz del sitio: variables del tema, fondo global, idioma del negocio y pedido por WhatsApp (si está activo). */
export function SiteShell({ theme, language = 'es', order, children, className }: { theme: ThemeConfig; language?: Locale; order?: OrderConfig | null; children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.root} ${className ?? ''}`} style={themeToVars(theme)} lang={language}>
      <BackgroundLayers background={theme.background} />
      <SiteI18nProvider language={language}>{order ? <OrderProvider config={order}>{children}</OrderProvider> : children}</SiteI18nProvider>
    </div>
  );
}
