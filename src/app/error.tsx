'use client';

import { useEffect } from 'react';
import styles from './status.module.css';

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Algo salió mal</p>
        <h1 className={styles.title}>No pudimos cargar esta página</h1>
        <p className={styles.text}>Puede ser un problema temporal de conexión. Intenta de nuevo en unos segundos.</p>
        {/* retry vuelve a pedir la página al servidor (reset sólo re-renderiza lo que falló). */}
        <button type="button" className={`${styles.link} ${styles.button}`} onClick={retry}>
          Reintentar
        </button>
        {error.digest && <p className={styles.digest}>Código: {error.digest}</p>}
      </div>
    </main>
  );
}
