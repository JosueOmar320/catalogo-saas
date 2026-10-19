'use client';

import { ImageIcon } from 'lucide-react';
import { useState } from 'react';
import type { CatalogImageView } from '@/lib/catalog/view-model';
import { useSiteT } from './SiteI18n';
import { SiteImage } from './SiteImage';
import styles from './site.module.css';

export function ImageGallery({ images, name }: { images: CatalogImageView[]; name: string }) {
  const [active, setActive] = useState(0);
  const t = useSiteT();
  const current = images[active];
  return (
    <div className={styles.gallerySlides}>
      <div className={styles.galleryMain}>
        {current ? (
          <SiteImage src={current.url} alt={current.alt} sizes="(max-width: 820px) 100vw, 600px" priority />
        ) : (
          <div className={styles.mediaPlaceholder}>
            <ImageIcon size={48} strokeWidth={1.25} aria-hidden />
          </div>
        )}
      </div>
      {images.length > 1 && (
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
    </div>
  );
}
