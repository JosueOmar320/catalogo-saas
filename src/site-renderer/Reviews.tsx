import { Star } from 'lucide-react';
import type { Translator } from '@/i18n/translate';
import { ratingOf, type PublicReview } from '@/lib/catalog/reviews';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import type { CatalogClientSite } from './catalog-client-model';
import { ReviewForm } from './ReviewForm';
import { siteTranslator } from './site-i18n';
import styles from './site.module.css';

/** Estrellas (llenas hasta el valor redondeado). */
export function Stars({ value, size = 16, t }: { value: number; size?: number; t: Translator }) {
  const full = Math.round(value);
  return (
    <span className={styles.stars} role="img" aria-label={t('{rating} de 5 estrellas', { rating: value })}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} fill={i < full ? 'currentColor' : 'none'} aria-hidden />
      ))}
    </span>
  );
}

/** Promedio con una cifra decimal en el formato del idioma del sitio ("4.8" / "4,8"). */
const averageText = (average: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(average);

/** "★ 4.8 (12)" en las tarjetas. `site`: el modelo completo (reseñas) o el recortado del catálogo (resumen ya calculado). */
export function RatingBadge({ site, item }: { site: Pick<CatalogClientSite, 'settings' | 'reviews' | 'ratings'>; item: CatalogItemView }) {
  const rating = site.ratings ? (site.ratings[item.id] ?? null) : ratingOf(site.reviews ?? [], item.id);
  if (!rating) return null;
  const t = siteTranslator(site.settings.language);
  const average = averageText(rating.average, site.settings.locale);
  return (
    <span className={styles.ratingBadge} role="img" aria-label={t('{rating} de 5 estrellas, {count} opiniones', { rating: average, count: rating.count })}>
      <Star size={13} fill="currentColor" aria-hidden />
      <span aria-hidden>
        {average} ({rating.count})
      </span>
    </span>
  );
}

/** Opiniones de un producto en su ficha: promedio, las más recientes y el formulario. */
export function ItemReviews({ site, item }: { site: SiteViewModel; item: CatalogItemView }) {
  if (!site.settings.reviews.enabled) return null;
  const t = siteTranslator(site.settings.language);
  const reviews = (site.reviews ?? []).filter((r) => r.itemId === item.id);
  const rating = ratingOf(reviews);
  return (
    <section className={styles.reviews} aria-labelledby="reviews-title">
      <h2 id="reviews-title" className={styles.relatedTitle}>
        {t('Opiniones')}
      </h2>
      {rating ? (
        <p className={styles.reviewSummary}>
          <Stars value={rating.average} size={18} t={t} />
          <strong>{averageText(rating.average, site.settings.locale)}</strong>
          <span>{rating.count === 1 ? t('1 opinión') : t('{count} opiniones', { count: rating.count })}</span>
        </p>
      ) : (
        <p className={styles.muted}>{t('Todavía no hay opiniones. ¡Sé el primero!')}</p>
      )}
      <ReviewList reviews={reviews.slice(0, 10)} t={t} locale={site.settings.locale} />
      <ReviewForm slug={site.business.slug} item={item.slug} demo={site.business.slug === 'demo'} />
    </section>
  );
}

export function ReviewList({ reviews, t, locale }: { reviews: PublicReview[]; t: Translator; locale: string }) {
  if (!reviews.length) return null;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <ul className={styles.reviewList}>
      {reviews.map((review) => (
        <li key={review.id}>
          <div className={styles.reviewHead}>
            <Stars value={review.rating} size={14} t={t} />
            <strong>{review.name}</strong>
            <time dateTime={review.createdAt}>{date.format(new Date(review.createdAt))}</time>
          </div>
          {review.body && <p>{review.body}</p>}
        </li>
      ))}
    </ul>
  );
}
