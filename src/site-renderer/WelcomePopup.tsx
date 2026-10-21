'use client';

import { Copy, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { isSaleOver } from '@/lib/catalog/sale-core';
import type { PopupProps } from './chrome';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

function seen(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    // Sin almacenamiento (modo privado): no se muestra, para no repetirla en cada página.
    return true;
  }
}

/**
 * Ventana de bienvenida: aparece una sola vez por visitante (se recuerda en su
 * navegador), unos segundos después de entrar y hasta su último día. Se
 * cierra con el botón, Escape o un clic fuera.
 */
export function WelcomePopup({ title, text, code, button, delay, endsOn, timeZone, storageKey }: PopupProps) {
  const t = useSiteT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (seen(storageKey) || (endsOn && timeZone && isSaleOver({ on: endsOn, timeZone }, new Date()))) return;
    const timer = window.setTimeout(() => {
      // No interrumpe si el visitante ya tiene otra ventana abierta (p. ej. su pedido).
      if (document.querySelector('dialog[open]')) return;
      ref.current?.showModal();
      try {
        localStorage.setItem(storageKey, '1');
      } catch {}
    }, delay * 1000);
    return () => window.clearTimeout(timer);
  }, [storageKey, delay, endsOn, timeZone]);

  const close = () => ref.current?.close();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {}
  };
  const external = button?.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <dialog
      ref={ref}
      className={styles.popup}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className={styles.popupPanel}>
        <button type="button" className={styles.popupClose} onClick={close} aria-label={t('Cerrar')}>
          <X size={18} aria-hidden />
        </button>
        <h2 id={titleId} className={styles.popupTitle}>
          {title}
        </h2>
        {text && <p className={styles.popupText}>{text}</p>}
        {code && (
          <div className={styles.popupCode}>
            <span>
              {t('Código')}: <strong>{code}</strong>
            </span>
            <button type="button" className={styles.linkButton} onClick={() => void copy()}>
              <Copy size={14} aria-hidden /> {copied ? t('Copiado') : t('Copiar código')}
            </button>
          </div>
        )}
        {button && (
          <a href={button.href} className={styles.btn} data-variant="solid" onClick={close} {...external}>
            {button.label}
          </a>
        )}
      </div>
    </dialog>
  );
}
