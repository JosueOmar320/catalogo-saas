import { Star } from 'lucide-react';
import { mediaUrl } from '@/lib/utils/storage';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { ReviewForm } from '../ReviewForm';
import { SiteImage } from '../SiteImage';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function TestimonialsSection({ section, site, env }: SectionProps<'testimonials'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const fromReviews = content.source === 'reviews';
  const reviewsOn = site.settings.reviews.enabled;
  // Reseñas de clientes aprobadas (las más recientes): la de un producto lleva su nombre.
  const itemNames = new Map(site.items.map((i) => [i.id, i.name]));
  const items = fromReviews
    ? (site.reviews ?? []).slice(0, 9).map((r) => ({ id: r.id, name: r.name, role: r.itemId ? (itemNames.get(r.itemId) ?? '') : '', text: r.body, photo: null, rating: r.rating, reply: r.reply ?? null }))
    : content.items.filter((item) => item.text.trim()).map((item) => ({ ...item, reply: null }));
  if (env.mode === 'public' && (fromReviews ? !reviewsOn : items.length === 0)) return null;
  const single = content.layout === 'single';
  const shown = single ? items.slice(0, 1) : items;

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={single} />
      <Placeholder show={items.length === 0 && (!fromReviews || env.mode !== 'public')}>
        {fromReviews
          ? reviewsOn
            ? t('Aquí aparecerán las reseñas que apruebes en el panel.')
            : t('Activa las reseñas en el panel (Reseñas) para mostrarlas aquí.')
          : t('Agrega testimonios de tus clientes desde el editor.')}
      </Placeholder>
      <div className={single ? '' : content.layout === 'slider' ? styles.carousel : styles.grid} style={single ? undefined : gridVars(content.columns)}>
        {shown.map((item) => {
          const photo = mediaUrl(item.photo);
          return (
            <figure key={item.id} className={`${styles.testimonial} ${single ? styles.testimonialSingle : ''}`}>
              {item.rating > 0 && (
                <div className={styles.stars} role="img" aria-label={t('{rating} de 5 estrellas', { rating: item.rating })}>
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" aria-hidden />
                  ))}
                </div>
              )}
              {item.text && <blockquote className={styles.quote}>“{item.text}”</blockquote>}
              {item.reply && (
                <p className={styles.reviewReply}>
                  <strong>{t('Respuesta de {business}', { business: site.business.name })}</strong> {item.reply}
                </p>
              )}
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
      {fromReviews && reviewsOn && env.mode !== 'preview' && (
        <div className={single ? styles.centerRow : undefined} style={{ marginTop: 24 }}>
          <ReviewForm slug={site.business.slug} item={null} demo={site.business.slug === 'demo'} />
        </div>
      )}
    </SectionFrame>
  );
}
