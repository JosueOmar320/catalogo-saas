'use client';

import { ArrowRight, X } from 'lucide-react';
import { useCallback, useSyncExternalStore } from 'react';
import { isSaleOver } from '@/lib/catalog/sale-core';
import type { AnnouncementProps } from './chrome';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

const listeners = new Set<() => void>();
const minuteTick = (onChange: () => void) => {
  listeners.add(onChange);
  const id = window.setInterval(onChange, 60_000);
  return () => {
    listeners.delete(onChange);
    window.clearInterval(id);
  };
};

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * Barra de anuncios arriba del header. Se oculta sola después de su último
 * día (se revisa en el navegador: la página pública está en caché) y, si se
 * permite, el visitante la cierra (se recuerda en su navegador).
 */
export function AnnouncementBar({ text, link, tone, endsOn, timeZone, dismissible, storageKey }: AnnouncementProps) {
  const t = useSiteT();
  // En el servidor (y al hidratar) se muestra; en el navegador se revisa la fecha y si la cerró.
  const hidden = useSyncExternalStore(
    minuteTick,
    useCallback(() => readDismissed(storageKey) || Boolean(endsOn && timeZone && isSaleOver({ on: endsOn, timeZone }, new Date())), [storageKey, endsOn, timeZone]),
    () => false,
  );
  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {}
    listeners.forEach((listener) => listener());
  };
  const external = link?.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <div className={styles.announcement} data-tone={tone} role="region" aria-label={t('Anuncio')}>
      <p className={styles.announcementText}>
        {link && !link.label ? (
          <a href={link.href} {...external}>
            {text}
          </a>
        ) : (
          <>
            <span>{text}</span>
            {link && (
              <a href={link.href} className={styles.announcementLink} {...external}>
                {link.label}
                <ArrowRight size={14} aria-hidden />
              </a>
            )}
          </>
        )}
      </p>
      {dismissible && (
        <button type="button" className={styles.announcementClose} onClick={dismiss} aria-label={t('Cerrar anuncio')}>
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
