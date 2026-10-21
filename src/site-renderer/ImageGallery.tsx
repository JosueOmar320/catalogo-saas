'use client';

import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CatalogImageView } from '@/lib/catalog/view-model';
import { useSiteT } from './SiteI18n';
import { SiteImage } from './SiteImage';
import styles from './site.module.css';

/**
 * Fotos de la ficha: la principal, miniaturas y, al tocar la principal, la
 * vista a pantalla completa (flechas, deslizar o el teclado; Escape cierra).
 */
export function ImageGallery({ images, name, priority = false }: { images: CatalogImageView[]; name: string; /** Precarga la foto principal (sólo la ficha: es su LCP). */ priority?: boolean }) {
  const [active, setActive] = useState(0);
  const t = useSiteT();
  const viewer = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const current = images[active];
  const many = images.length > 1;
  const go = (step: number) => setActive((index) => (index + step + images.length) % images.length);

  return (
    <div className={styles.gallerySlides}>
      <div className={styles.galleryMain}>
        {current ? (
          <button type="button" className={styles.galleryZoom} onClick={() => viewer.current?.showModal()} aria-label={t('Ver la imagen de {name} en grande', { name })}>
            <SiteImage src={current.url} alt={current.alt} sizes="(max-width: 820px) 100vw, 600px" priority={priority} />
          </button>
        ) : (
          <div className={styles.mediaPlaceholder}>
            <ImageIcon size={48} strokeWidth={1.25} aria-hidden />
          </div>
        )}
      </div>
      {many && (
        <div className={styles.thumbs}>
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              className={`${styles.thumb} ${index === active ? styles.thumbActive : ''}`}
              onClick={() => setActive(index)}
              aria-label={t('Ver imagen {n} de {name}', { n: index + 1, name })}
              aria-current={index === active}
            >
              <SiteImage src={image.thumbUrl} alt="" sizes="68px" />
            </button>
          ))}
        </div>
      )}
      {current && (
        <dialog
          ref={viewer}
          className={styles.lightbox}
          aria-label={t('Fotos de {name}', { name })}
          onClick={(event) => {
            if (event.target === event.currentTarget) viewer.current?.close();
          }}
          onKeyDown={(event) => {
            if (!many) return;
            if (event.key === 'ArrowRight') go(1);
            if (event.key === 'ArrowLeft') go(-1);
          }}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            touchStart.current = null;
            if (!many || start === null || end === undefined || Math.abs(end - start) < 40) return;
            go(end < start ? 1 : -1);
          }}
        >
          <div className={styles.lightboxImage}>
            <SiteImage src={current.url} alt={current.alt} sizes="100vw" />
          </div>
          <button type="button" className={`${styles.lightboxButton} ${styles.lightboxClose}`} onClick={() => viewer.current?.close()} aria-label={t('Cerrar')}>
            <X size={22} aria-hidden />
          </button>
          {many && (
            <>
              <button type="button" className={`${styles.lightboxButton} ${styles.lightboxPrev}`} onClick={() => go(-1)} aria-label={t('Imagen anterior')}>
                <ChevronLeft size={26} aria-hidden />
              </button>
              <button type="button" className={`${styles.lightboxButton} ${styles.lightboxNext}`} onClick={() => go(1)} aria-label={t('Imagen siguiente')}>
                <ChevronRight size={26} aria-hidden />
              </button>
              <p className={styles.lightboxCount} aria-live="polite">
                {t('{n} de {total}', { n: active + 1, total: images.length })}
              </p>
            </>
          )}
        </dialog>
      )}
    </div>
  );
}
