import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SocialLinks } from '../SocialLinks';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function SocialSection({ section, site, env }: SectionProps<'social'>) {
  const { content } = section;
  const empty = site.business.socialLinks.length === 0;
  if (empty && env.mode === 'public') return null;
  const center = content.alignment === 'center';
  return (
    <SectionFrame section={section} theme={site.theme}>
      <div className={center ? styles.textCenter : ''}>
        <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
        <Placeholder show={empty}>Agrega tus redes en Configuración › Redes sociales.</Placeholder>
        <div className={center ? styles.centerRow : ''}>
          <SocialLinks site={site} display={content.display} />
        </div>
      </div>
    </SectionFrame>
  );
}
