'use client';

import { useEffect } from 'react';
import { useBrowserT } from '@/lib/hooks/use-browser-t';
import styles from './status.module.css';

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Se muestra fuera del I18nProvider de cada sección: el idioma se toma del navegador.
  const { t } = useBrowserT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{t('Algo salió mal')}</p>
        <h1 className={styles.title}>{t('No pudimos cargar esta página')}</h1>
        <p className={styles.text}>{t('Puede ser un problema temporal de conexión. Intenta de nuevo en unos segundos.')}</p>
        {/* retry vuelve a pedir la página al servidor (reset sólo re-renderiza lo que falló). */}
        <button type="button" className={`${styles.link} ${styles.button}`} onClick={retry}>
          {t('Reintentar')}
        </button>
        {error.digest && <p className={styles.digest}>{t('Código: {code}', { code: error.digest })}</p>}
      </div>
    </main>
  );
}
