'use client';

import Link from 'next/link';
import { useBrowserT } from '@/lib/hooks/use-browser-t';
import styles from './status.module.css';

/**
 * 404 de la app. Cliente a propósito: si leyera la cookie de idioma en el
 * servidor, un notFound() dentro de una página estática (ISR, p. ej. un
 * catálogo que no existe) la volvería dinámica en tiempo de ejecución y
 * Next respondería 500 en lugar de 404. El idioma se elige en el navegador.
 */
export default function NotFound() {
  const { t } = useBrowserT();
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{t('Error 404')}</p>
        <h1 className={styles.title}>{t('No encontramos esta página')}</h1>
        <p className={styles.text}>{t('Puede que el enlace esté mal escrito o que la página ya no exista.')}</p>
        <Link className={styles.link} href="/">{t('Ir al inicio')}</Link>
      </div>
    </main>
  );
}
