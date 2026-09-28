import Image from 'next/image';
import type { CSSProperties } from 'react';
import { env as appEnv } from '@/lib/env';
import { mediaUrl } from '@/lib/utils/storage';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteImage } from '../SiteImage';
import styles from '../site.module.css';
import type { SectionProps } from './types';

const RATIO = { square: '1 / 1', landscape: '4 / 3', portrait: '3 / 4', original: 'auto' } as const;

export function GallerySection({ section, site, env }: SectionProps<'gallery'>) {
  const { content } = section;
  const images = content.images.flatMap((img) => {
    const url = mediaUrl(img.path);
    return url ? [{ url, caption: img.caption }] : [];
  });
  if (images.length === 0 && env.mode === 'public') return null;
  const masonry = content.layout === 'masonry' || content.ratio === 'original';
  const sizes = `(max-width: 600px) ${Math.round(100 / content.columns.mobile)}vw, ${Math.round(100 / content.columns.desktop)}vw`;
  const containerClass = masonry ? styles.masonry : content.layout === 'slider' ? styles.carousel : styles.grid;

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />
      <Placeholder show={images.length === 0}>Agrega imágenes a la galería desde el editor.</Placeholder>
      <div className={`${styles.gallery} ${containerClass}`} data-gap={content.gap} style={gridVars(content.columns)}>
        {images.map((img, i) => (
          <figure key={`${img.url}-${i}`} className={styles.galleryItem} style={masonry ? undefined : ({ aspectRatio: RATIO[content.ratio] } as CSSProperties)}>
            {masonry ? (
              <Image src={img.url} alt={img.caption} width={800} height={800} sizes={sizes} unoptimized={!appEnv.imageOptimization} />
            ) : (
              <SiteImage src={img.url} alt={img.caption} sizes={sizes} />
            )}
            {img.caption && <figcaption>{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </SectionFrame>
  );
}
