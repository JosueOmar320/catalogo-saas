import Link from 'next/link';
import styles from './status.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Error 404</p>
        <h1 className={styles.title}>No encontramos esta página</h1>
        <p className={styles.text}>Puede que el enlace esté mal escrito o que la página ya no exista.</p>
        <Link className={styles.link} href="/">Ir al inicio</Link>
      </div>
    </main>
  );
}
