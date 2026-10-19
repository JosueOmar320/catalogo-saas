import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';

export const RELATED_COUNT = 4;

/**
 * Relacionados: primero de la misma categoría, luego destacados; disponibles
 * antes que agotados. Siempre del mismo tipo (producto o servicio).
 */
export function relatedItems(site: SiteViewModel, item: CatalogItemView, count = RELATED_COUNT): CatalogItemView[] {
  const pool = site.items.filter((other) => other.id !== item.id && other.type === item.type);
  const score = (other: CatalogItemView) => (item.categoryId && other.categoryId === item.categoryId ? 4 : 0) + (other.isFeatured ? 2 : 0) + (other.isAvailable ? 1 : 0);
  return pool
    .map((other, index) => ({ other, index, score: score(other) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map(({ other }) => other);
}
