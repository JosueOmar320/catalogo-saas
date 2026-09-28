import Link from 'next/link';
import styles from '@/app/status.module.css';
import { env } from '@/lib/env';

export default function SiteNotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>No disponible</p>
        <h1 className={styles.title}>Esta página no existe o no está publicada</h1>
        <p className={styles.text}>Si eres el dueño, publícala desde tu panel para que tus clientes puedan verla.</p>
        <Link className={styles.link} href={env.siteUrl}>Ir a {env.appName}</Link>
      </div>
    </main>
  );
}
