import { mediaUrl } from '@/lib/utils/storage';
import { RichText } from '../RichText';
import { SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import { SiteImage } from '../SiteImage';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function TextSection({ section, site, env, links }: SectionProps<'text'>) {
  const { content } = section;
  const image = content.imagePosition !== 'none' ? mediaUrl(content.image.path) : null;
  const center = content.alignment === 'center';
  const widthClass = content.width === 'narrow' ? styles.narrow : content.width === 'normal' ? styles.readable : '';
  const text = (
    <div className={center ? styles.textCenter : ''}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
      {content.body && <RichText source={content.body} />}
      {content.button.label && (
        <div className={`${styles.btnRow} ${styles.spaceTop}`}>
          <SiteButton button={content.button} theme={site.theme} links={links} env={env} />
        </div>
      )}
    </div>
  );

  return (
    <SectionFrame section={section} theme={site.theme}>
      <div className={image && content.imagePosition !== 'top' ? '' : widthClass}>
        {image && content.imagePosition === 'top' && (
          <div className={`${styles.textMedia} ${styles.textMediaTop}`}>
            <SiteImage src={image} alt="" sizes="100vw" />
          </div>
        )}
        {image && (content.imagePosition === 'left' || content.imagePosition === 'right') ? (
          <div className={styles.textLayout} data-image={content.imagePosition}>
            {text}
            <div className={styles.textMedia}>
              <SiteImage src={image} alt="" sizes="(max-width: 820px) 100vw, 50vw" />
            </div>
          </div>
        ) : (
          text
        )}
      </div>
    </SectionFrame>
  );
}
