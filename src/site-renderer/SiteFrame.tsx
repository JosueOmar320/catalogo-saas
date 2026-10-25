import type { ReactNode } from 'react';
import type { ThemeConfig } from '@/lib/design/theme';
import styles from './site.module.css';

/**
 * Header + contenido. Con el menú lateral, una cuadrícula: la barra de
 * anuncios arriba, el menú a la izquierda y la página (con su pie) a la
 * derecha; en el celular vuelve a ser una barra arriba (todo con CSS, por el
 * ancho del sitio, así la vista previa del editor también lo muestra).
 */
export function SiteFrame({ theme, header, children }: { theme: ThemeConfig; header: ReactNode; children: ReactNode }) {
  if (theme.header.layout !== 'vertical') {
    return (
      <>
        {header}
        {children}
      </>
    );
  }
  return (
    <div className={styles.navFrame} data-width={theme.header.verticalWidth}>
      {header}
      <div className={styles.siteBody}>{children}</div>
    </div>
  );
}
