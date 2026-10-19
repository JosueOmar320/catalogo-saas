import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/app/status.module.css';
import { linkSecret } from '@/features/notifications/catalog-review';
import { getT } from '@/i18n/server';
import { verifyUnsubscribeToken } from '@/lib/email/links';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Avisos por correo'), robots: { index: false, follow: false } };
}

/**
 * Página del enlace "Dejar de recibir estos avisos". Visitarla no cambia nada:
 * hay que confirmar con el botón (POST), así los escáneres de enlaces del
 * correo no dan de baja a nadie.
 */
export default async function UnsubscribePage({ searchParams }: PageProps<'/baja'>) {
  const { token, listo, error } = await searchParams;
  const t = await getT();
  const valid = typeof token === 'string' && verifyUnsubscribeToken(token, linkSecret()) !== null;

  let title: string;
  let text: string;
  let body: React.ReactNode = null;
  if (listo) {
    title = t('Listo, ya no recibirás el aviso semanal');
    text = t('Puedes volver a activarlo cuando quieras en Mi cuenta.');
  } else if (error || !valid) {
    title = t('Este enlace no es válido');
    text = t('Puede que haya expirado. Inicia sesión y apaga el aviso en Mi cuenta.');
  } else {
    title = t('¿Dejar de recibir el aviso semanal?');
    text = t('Es el correo de los lunes con los productos sin foto, sin precio o sin categoría de tus negocios.');
    body = (
      <form method="post" action="/api/email/unsubscribe">
        <input type="hidden" name="token" value={token as string} />
        <input type="hidden" name="source" value="page" />
        <button type="submit" className={`${styles.link} ${styles.button}`}>{t('Dejar de recibirlo')}</button>
      </form>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{t('Avisos por correo')}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        {body}
        {!body && <Link className={styles.link} href="/cuenta">{t('Ir a Mi cuenta')}</Link>}
      </div>
    </main>
  );
}
