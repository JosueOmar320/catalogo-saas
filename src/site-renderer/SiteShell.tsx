import type { ReactNode } from 'react';
import type { ThemeConfig } from '@/lib/design/theme';
import { BackgroundLayers } from './Background';
import styles from './site.module.css';
import { themeToVars } from './theme-vars';

/** Raíz del sitio: variables del tema + fondo global. */
export function SiteShell({ theme, children, className }: { theme: ThemeConfig; children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.root} ${className ?? ''}`} style={themeToVars(theme)}>
      <BackgroundLayers background={theme.background} />
      {children}
    </div>
  );
}
