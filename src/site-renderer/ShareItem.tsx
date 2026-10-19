'use client';

import { Check, Link2, Share2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Icon } from './Icon';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

const noSubscribe = () => () => {};

/**
 * Compartir un producto: menú nativo del teléfono (si existe), WhatsApp y
 * copiar el enlace. En la computadora, el menú nativo no suele estar: se
 * muestran WhatsApp y copiar.
 */
export function ShareItem({ name, url }: { name: string; url: string }) {
  const t = useSiteT();
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === 'function', () => false);
  const text = t('Mira esto: {name}', { name });

  return (
    <div className={styles.share} role="group" aria-label={t('Compartir')}>
      <span className={styles.shareLabel}>{t('Compartir')}</span>
      {canShare && (
        <button type="button" className={styles.shareButton} onClick={() => void navigator.share({ title: name, text, url }).catch(() => {})} aria-label={t('Compartir…')}>
          <Share2 size={16} aria-hidden />
        </button>
      )}
      <a className={styles.shareButton} href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label={t('Compartir por WhatsApp')}>
        <Icon id="message-circle" size={16} />
      </a>
      <button
        type="button"
        className={styles.shareButton}
        onClick={() =>
          void navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
        aria-label={copied ? t('Enlace copiado') : t('Copiar enlace')}
      >
        {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
      </button>
      <span className={styles.visuallyHidden} role="status" aria-live="polite">{copied ? t('Enlace copiado') : ''}</span>
    </div>
  );
}
