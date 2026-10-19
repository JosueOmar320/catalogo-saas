import Link from 'next/link';
import styles from '@/app/status.module.css';
import { env } from '@/lib/env';
import { siteStatusTexts } from '@/site-renderer/status';

export default function SiteNotFound() {
  // Sin datos del negocio (no se sabe cuál es): idioma por defecto.
  const texts = siteStatusTexts();
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{texts.unavailable}</p>
        <h1 className={styles.title}>{texts.missingTitle}</h1>
        <p className={styles.text}>{texts.missingText}</p>
        <Link className={styles.link} href={env.siteUrl}>{texts.goTo(env.appName)}</Link>
      </div>
    </main>
  );
}
