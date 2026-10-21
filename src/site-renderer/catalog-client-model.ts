import type { AttributeDef } from '@/lib/catalog/attributes';
import type { PublicReview, RatingSummary } from '@/lib/catalog/reviews';
import type { CatalogSettings } from '@/lib/catalog/settings';
import type { CatalogCategoryView, CatalogItemView } from '@/lib/catalog/view-model';
import type { ThemeConfig } from '@/lib/design/theme';
import type { SectionOf } from '@/lib/site/section-schemas';
import type { SiteViewModel } from '@/lib/site/view-model';

/**
 * Lo que las tarjetas, colecciones y filtros leen del sitio. Lo cumplen el
 * modelo completo (SiteViewModel) y el recortado que viaja al navegador para
 * la sección de catálogo: así los componentes se comparten sin duplicarlos.
 */
export type CatalogClientSite = {
  business: Pick<SiteViewModel['business'], 'name' | 'slug' | 'contact'>;
  theme: ThemeConfig;
  settings: Pick<CatalogSettings, 'language' | 'locale' | 'currency' | 'priceFormat' | 'reviews' | 'contactActions'> & {
    order: Pick<CatalogSettings['order'], 'enabled' | 'branches'>;
  };
  categories: CatalogCategoryView[];
  items: CatalogItemView[];
  attributeDefs: AttributeDef[];
  url: string;
  /** Reseñas completas (el modelo completo). */
  reviews?: PublicReview[];
  /** Resumen por producto ya calculado (el modelo recortado: no viajan las reseñas). */
  ratings?: Record<string, RatingSummary>;
};

const NO_PAIRINGS: string[] = [];

/** Promedio y cantidad de reseñas por producto, en una sola pasada. */
function ratingsByItem(reviews: PublicReview[]): Record<string, RatingSummary> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const review of reviews) {
    if (!review.itemId) continue;
    const entry = sums.get(review.itemId) ?? { total: 0, count: 0 };
    entry.total += review.rating;
    entry.count += 1;
    sums.set(review.itemId, entry);
  }
  const ratings: Record<string, RatingSummary> = {};
  for (const [itemId, { total, count }] of sums) ratings[itemId] = { average: Math.round((total / count) * 10) / 10, count };
  return ratings;
}

/**
 * Modelo recortado para la sección de catálogo (Client Component): sólo lo
 * que la cuadrícula y sus filtros dibujan. Fuera quedan las páginas, el SEO,
 * la navegación, las reseñas completas y, de cada ítem, la descripción larga
 * y los «combínalo con» (sólo los usa la ficha). Función pura: la ejecuta el
 * servidor en el sitio público y el navegador en la vista previa del editor.
 */
export function toCatalogClientSite(site: SiteViewModel, section: SectionOf<'catalog'>): CatalogClientSite {
  const { itemType, presentation, filters } = section.content;
  // La presentación "detalle" sí muestra la descripción larga (si las tarjetas la enseñan).
  const keepDescription = presentation.layout === 'detail' && site.theme.cards.showDescription && (presentation.fields.description ?? true);
  const items = (itemType === 'any' ? site.items : site.items.filter((item) => item.type === itemType)).map((item) => ({
    ...item,
    description: keepDescription ? item.description : null,
    pairings: NO_PAIRINGS,
  }));
  const chosen = new Set(filters.attributes);
  const { language, locale, currency, priceFormat, reviews, contactActions, order } = site.settings;
  return {
    business: { name: site.business.name, slug: site.business.slug, contact: site.business.contact },
    theme: site.theme,
    settings: { language, locale, currency, priceFormat, reviews, contactActions, order: { enabled: order.enabled, branches: order.branches } },
    categories: site.categories,
    items,
    attributeDefs: site.attributeDefs.filter((def) => def.filterable || def.showInCard || def.showInDetail || chosen.has(def.id)),
    url: site.url,
    ratings: reviews.enabled && site.reviews?.length ? ratingsByItem(site.reviews) : undefined,
  };
}
