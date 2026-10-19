import { resolveLink } from '@/lib/site/links';
import { mediaUrl } from '@/lib/utils/storage';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteImage } from '../SiteImage';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

const RATIO = { landscape: '4 / 3', wide: '16 / 9', square: '1 / 1', portrait: '3 / 4' } as const;

export function ImageSection({ section, site, env, links, index }: SectionProps<'image'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const url = mediaUrl(content.image.path);
  if (!url && env.mode === 'public') return null;
  const target = resolveLink(content.link, links);
  const figure = url && (
    <div className={styles.imageBlock} data-rounded={content.rounded || undefined} style={content.ratio === 'original' ? undefined : { aspectRatio: RATIO[content.ratio] }}>
      {content.ratio === 'original' ? (
        // eslint-disable-next-line @next/next/no-img-element -- proporción original sin conocer medidas
        <img src={url} alt={content.alt} loading={index === 0 ? 'eager' : 'lazy'} className={styles.imageNatural} />
      ) : (
        <SiteImage src={url} alt={content.alt} sizes="(max-width: 1200px) 100vw, 1200px" priority={index === 0} />
      )}
    </div>
  );
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />
      <Placeholder show={!url}>{t('Elige una imagen desde el editor (o pídesela a Garfield).')}</Placeholder>
      {figure && (
        <figure className={styles.imageFigure}>
          {target && env.mode !== 'preview' ? (
            <a href={target.href} target={target.external ? '_blank' : undefined} rel={target.external ? 'noopener noreferrer' : undefined}>{figure}</a>
          ) : (
            figure
          )}
          {content.caption && <figcaption className={styles.imageCaption}>{content.caption}</figcaption>}
        </figure>
      )}
    </SectionFrame>
  );
}
