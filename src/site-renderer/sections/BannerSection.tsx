import { mediaUrl } from '@/lib/utils/storage';
import { BackgroundLayers } from '../Background';
import { SectionFrame } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import { SiteImage } from '../SiteImage';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function BannerSection({ section, site, env, links }: SectionProps<'banner'>) {
  const { content } = section;
  const boxed = content.layout !== 'full';
  const image = mediaUrl(content.image.path);
  const text = (
    <div className={styles.banner} data-height={content.height} data-align={content.alignment}>
      {content.eyebrow && <span className={styles.eyebrow}>{content.eyebrow}</span>}
      {content.title && <h2 className={styles.h2}>{content.title}</h2>}
      {content.subtitle && <p className={styles.lead}>{content.subtitle}</p>}
      {content.button.label && (
        <div className={styles.btnRow}>
          <SiteButton button={content.button} theme={site.theme} links={links} env={env} />
        </div>
      )}
    </div>
  );
  const inner =
    content.layout === 'split' && image ? (
      <div className={styles.bannerSplit}>
        {text}
        <div className={styles.textMedia}>
          <SiteImage src={image} alt="" sizes="(max-width: 820px) 100vw, 45vw" />
        </div>
      </div>
    ) : (
      text
    );

  return (
    <SectionFrame section={section} theme={site.theme} backgroundOnContent={boxed}>
      {boxed ? (
        <div className={styles.bannerBoxed}>
          <BackgroundLayers background={section.style.background} />
          {inner}
        </div>
      ) : (
        inner
      )}
    </SectionFrame>
  );
}
