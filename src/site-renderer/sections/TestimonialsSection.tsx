import { Star } from 'lucide-react';
import { mediaUrl } from '@/lib/utils/storage';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteImage } from '../SiteImage';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function TestimonialsSection({ section, site, env }: SectionProps<'testimonials'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const items = content.items.filter((item) => item.text.trim());
  if (items.length === 0 && env.mode === 'public') return null;
  const single = content.layout === 'single';
  const shown = single ? items.slice(0, 1) : items;

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={single} />
      <Placeholder show={items.length === 0}>{t('Agrega testimonios de tus clientes desde el editor.')}</Placeholder>
      <div className={single ? '' : content.layout === 'slider' ? styles.carousel : styles.grid} style={single ? undefined : gridVars(content.columns)}>
        {shown.map((item) => {
          const photo = mediaUrl(item.photo);
          return (
            <figure key={item.id} className={`${styles.testimonial} ${single ? styles.testimonialSingle : ''}`}>
              {item.rating > 0 && (
                <div className={styles.stars} aria-label={t('{rating} de 5 estrellas', { rating: item.rating })}>
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" aria-hidden />
                  ))}
                </div>
              )}
              <blockquote className={styles.quote}>“{item.text}”</blockquote>
              <figcaption className={styles.author}>
                <span className={styles.avatar}>{photo ? <SiteImage src={photo} alt="" sizes="44px" /> : item.name.charAt(0).toUpperCase()}</span>
                <span>
                  <span className={styles.authorName}>{item.name}</span>
                  {item.role && <span className={styles.muted}>{item.role}</span>}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </SectionFrame>
  );
}
