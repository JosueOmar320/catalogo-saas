'use client';

import styles from './status.module.css';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Algo salió mal</p>
        <h1 className={styles.title}>No pudimos cargar esta página</h1>
        <p className={styles.text}>Puede ser un problema temporal de conexión. Intenta de nuevo en unos segundos.</p>
        <button type="button" className={`${styles.link} ${styles.button}`} onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
