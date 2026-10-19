import Link from 'next/link';
import { getT } from '@/i18n/server';
import styles from './status.module.css';

export default async function NotFound() {
  const t = await getT();
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
