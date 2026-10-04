import type { CSSProperties } from 'react';
import { mediaUrl } from '@/lib/utils/storage';
import { parseVideoUrl } from '@/lib/site/video';
import type { SectionOf } from '@/lib/site/section-schemas';
import { Icon } from '../Icon';
import { RichText } from '../RichText';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import { SiteImage } from '../SiteImage';
import styles from '../site.module.css';
import type { SectionProps } from './types';

type Column = SectionOf<'columns'>['content']['columns'][number];
type Block = Column['blocks'][number];

const RATIO = { square: '1 / 1', landscape: '4 / 3', portrait: '3 / 4', wide: '16 / 9' } as const;
const VIDEO_RATIO = { '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1' } as const;

/**
 * Sección "Columnas": composición libre de un solo nivel (columnas → bloques).
 * Suficiente para imagen + texto, tarjetas, procesos, listas con íconos o
 * varias llamadas a la acción, sin convertir el editor en un árbol infinito.
 */
export function ColumnsSection({ section, site, env, links, index }: SectionProps<'columns'>) {
  const { content } = section;
  const count = content.layout.split('-').length;
  const columns = Array.from({ length: count }, (_, i) => content.columns[i] ?? { id: `empty-${i}`, blocks: [], align: 'left' as const, surface: 'none' as const, padding: 'none' as const });
  const empty = columns.every((c) => c.blocks.length === 0);
  if (empty && env.mode === 'public' && !content.title) return null;
  const vars = { '--col-template': content.layout.split('-').map((n) => `minmax(0, ${n}fr)`).join(' ') } as CSSProperties;

  const block = (b: Block, column: Column) => {
    switch (b.kind) {
      case 'heading': {
        const Tag = b.level;
        return (
          <div key={b.id} className={styles.colHeading}>
            {b.eyebrow && <p className={styles.eyebrow}>{b.eyebrow}</p>}
            {b.text && <Tag className={b.level === 'h2' ? styles.h2 : styles.h3}>{b.text}</Tag>}
          </div>
        );
      }
      case 'text':
        return b.body ? <RichText key={b.id} source={b.body} className={styles.colText} /> : null;
      case 'image': {
        const url = mediaUrl(b.image.path);
        if (!url) return env.mode === 'public' ? null : <div key={b.id} className={styles.colImagePlaceholder}>Imagen</div>;
        return (
          <div key={b.id} className={styles.colImage} data-rounded={b.rounded || undefined} data-shadow={b.shadow || undefined} style={b.ratio === 'original' ? undefined : { aspectRatio: RATIO[b.ratio] }}>
            {b.ratio === 'original' ? (
              // eslint-disable-next-line @next/next/no-img-element -- proporción original
              <img src={url} alt={b.alt} loading={index === 0 ? 'eager' : 'lazy'} className={styles.imageNatural} />
            ) : (
              <SiteImage src={url} alt={b.alt} sizes={`(max-width: 700px) 100vw, ${Math.round(1200 / count)}px`} priority={index === 0} />
            )}
          </div>
        );
      }
      case 'buttons':
        return b.items.length ? (
          <div key={b.id} className={styles.btnRow} data-align={column.align}>
            {b.items.map((button, i) => <SiteButton key={i} button={button} theme={site.theme} links={links} env={env} />)}
          </div>
        ) : null;
      case 'list':
        return (
          <ul key={b.id} className={styles.colList} data-marker={b.marker}>
            {b.items.map((item, i) => (
              <li key={item.id}>
                <span className={styles.colListMarker} aria-hidden>
                  {b.marker === 'number' ? i + 1 : b.marker === 'bullet' ? '•' : <Icon id={b.marker === 'icon' && item.icon ? item.icon : 'check'} size={16} />}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        );
      case 'card': {
        const url = mediaUrl(b.image.path);
        return (
          <div key={b.id} className={styles.colCard}>
            {url ? (
              <div className={styles.colCardImage}><SiteImage src={url} alt={b.title} sizes="400px" /></div>
            ) : b.icon ? (
              <span className={styles.featureIcon} data-style="circle"><Icon id={b.icon} size={22} /></span>
            ) : null}
            {b.title && <h3 className={styles.h3}>{b.title}</h3>}
            {b.text && <p className={styles.muted}>{b.text}</p>}
            {b.button.label && <div className={styles.btnRow}><SiteButton button={b.button} theme={site.theme} links={links} env={env} small /></div>}
          </div>
        );
      }
      case 'icon':
        return (
          <span key={b.id} className={styles.colIcon} data-size={b.size} data-shape={b.shape}>
            <Icon id={b.icon} size={b.size === 'lg' ? 34 : b.size === 'sm' ? 18 : 26} />
          </span>
        );
      case 'badge':
        return b.text ? <span key={b.id} className={styles.colBadge} data-tone={b.tone}>{b.text}</span> : null;
      case 'stat':
        return (
          <div key={b.id} className={styles.colStat}>
            <span className={styles.statValue}>{b.value}</span>
            {b.label && <span className={styles.statLabel}>{b.label}</span>}
          </div>
        );
      case 'divider':
        return <hr key={b.id} className={styles.colDivider} />;
      case 'spacer':
        return <div key={b.id} className={styles.colSpacer} data-size={b.size} aria-hidden />;
      case 'video': {
        const video = b.url ? parseVideoUrl(b.url) : null;
        if (!video) return null;
        return (
          <div key={b.id} className={styles.videoFrame} style={{ aspectRatio: VIDEO_RATIO[b.ratio] }}>
            {video.kind === 'file' ? (
              <video src={video.src} controls playsInline preload="metadata" />
            ) : (
              <iframe src={video.embed} title="Video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            )}
          </div>
        );
      }
    }
  };

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center />
      <Placeholder show={empty}>Agrega bloques a cada columna desde el editor (título, texto, imagen, botones, lista, tarjeta…).</Placeholder>
      <div className={styles.colGrid} style={vars} data-count={count} data-gap={content.gap} data-valign={content.verticalAlign} data-tablet={content.tablet} data-mobile={content.mobile} data-reverse={content.reverseOnMobile || undefined}>
        {columns.map((column) => (
          <div key={column.id} className={styles.colCell} data-align={column.align} data-surface={column.surface} data-padding={column.padding}>
            {column.blocks.map((b) => block(b, column))}
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}
