import { heroText } from '@/lib/site/resolve';
import { mediaUrl } from '@/lib/utils/storage';
import { SectionFrame } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import { SiteImage } from '../SiteImage';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function HeroSection({ section, site, env, links, index }: SectionProps<'hero'>) {
  const { content } = section;
  const text = heroText(content, site);
  const image = mediaUrl(content.image.path);
  const Heading = index === 0 ? 'h1' : 'h2';
  const body = (
    <div className={styles.heroInner}>
      {content.showLogo && site.business.logoUrl && (
        <div className={styles.heroLogo}>
          <SiteImage src={site.business.logoUrl} alt={site.business.name} sizes="84px" />
        </div>
      )}
      {text.eyebrow && <span className={styles.eyebrow}>{text.eyebrow}</span>}
      <Heading className={styles.h1}>{text.title}</Heading>
      {text.subtitle && <p className={styles.lead}>{text.subtitle}</p>}
      {(content.primaryButton.label || content.secondaryButton.label) && (
        <div className={styles.btnRow}>
          <SiteButton button={content.primaryButton} theme={site.theme} links={links} env={env} />
          <SiteButton button={content.secondaryButton} theme={site.theme} links={links} env={env} />
        </div>
      )}
    </div>
  );

  return (
    <SectionFrame section={section} theme={site.theme} priority={index === 0} videoUrl={content.videoUrl || undefined}>
      <div className={styles.hero} data-height={content.height} data-layout={content.layout}>
        {content.layout === 'split' ? (
          <div className={styles.heroSplit}>
            {body}
            {image && (
              <div className={styles.heroMedia}>
                <SiteImage src={image} alt="" sizes="(max-width: 820px) 100vw, 50vw" priority={index === 0} />
              </div>
            )}
          </div>
        ) : (
          body
        )}
      </div>
    </SectionFrame>
  );
}
