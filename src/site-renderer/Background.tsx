import Image from 'next/image';
import { optimizable } from './SiteImage';
import type { CSSProperties } from 'react';
import { alpha } from '@/lib/design/color';
import type { Background } from '@/lib/design/background';
import { gradientCss, patternCss } from '@/lib/design/background-core';
import { mediaUrl } from '@/lib/utils/storage';
import styles from './site.module.css';

/**
 * Capas de fondo (base + imagen + overlay) detrás del contenido. El padre
 * debe tener `position: relative` (clase `layered`).
 */
export function BackgroundLayers({ background, priority = false, videoUrl }: { background: Background; priority?: boolean; videoUrl?: string }) {
  if (background.type === 'inherit' && !videoUrl) return null;
  const video = videoUrl || (background.type === 'video' && background.video.url) || '';
  const base: CSSProperties = {};
  if (background.type === 'color' || background.type === 'pattern' || background.type === 'image' || background.type === 'video') base.backgroundColor = background.color;
  if (background.type === 'gradient') base.backgroundImage = gradientCss(background);
  if (background.type === 'pattern') {
    const pattern = patternCss(background.pattern.id, background.pattern.color, background.pattern.opacity, background.pattern.scale);
    base.backgroundImage = pattern.image;
    base.backgroundSize = pattern.size;
  }

  const imageUrl = background.type === 'image' ? mediaUrl(background.image.path) : null;
  const { image, overlay } = background;
  // cover sin repetición → next/image (optimizado); el resto (y la imagen fija) → CSS background.
  const useNextImage = imageUrl && image.size === 'cover' && !image.repeat && !image.fixed;

  return (
    <div className={styles.bgLayers} aria-hidden>
      <div className={styles.bgLayer} style={base} />
      {imageUrl && useNextImage && (
        <div className={styles.bgLayer} style={{ opacity: image.opacity / 100 }}>
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="100vw"
            priority={priority}
            unoptimized={!optimizable(imageUrl)}
            style={{ objectFit: 'cover', objectPosition: image.position }}
          />
        </div>
      )}
      {imageUrl && !useNextImage && (
        <div
          className={styles.bgLayer}
          style={{
            opacity: image.opacity / 100,
            backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")`,
            backgroundSize: image.size,
            backgroundRepeat: image.repeat ? 'repeat' : 'no-repeat',
            backgroundPosition: image.position,
            backgroundAttachment: image.fixed ? 'fixed' : undefined,
          }}
        />
      )}
      {video && <video className={styles.bgLayer} src={video} autoPlay muted loop playsInline preload="metadata" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />}
      {overlay.opacity > 0 && background.type !== 'color' && <div className={styles.bgLayer} style={{ backgroundColor: alpha(overlay.color, overlay.opacity / 100) }} />}
    </div>
  );
}
