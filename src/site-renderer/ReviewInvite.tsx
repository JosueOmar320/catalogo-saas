'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { REVIEW_INVITE_PARAM } from '@/lib/catalog/reviews';
import { ReviewForm } from './ReviewForm';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

/**
 * Enlace para pedir reseñas: con `?opinar` en la dirección se abre el
 * formulario de opinión sobre el negocio. Se lee en el cliente para no
 * romper la caché de la página.
 */
export function ReviewInvite({ slug, businessName }: { slug: string; businessName: string }) {
  const t = useSiteT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(REVIEW_INVITE_PARAM)) ref.current?.showModal();
  }, []);

  const close = () => ref.current?.close();

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
          {t('¿Qué te pareció {business}?', { business: businessName })}
        </h2>
        <ReviewForm slug={slug} item={null} startOpen />
      </div>
    </dialog>
  );
}
