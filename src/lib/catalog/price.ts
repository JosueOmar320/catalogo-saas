import type { CatalogItemView } from './view-model';

/** Descuento entero (20 = "-20%") si el ítem tiene un precio anterior mayor. */
export function discountPercent(item: Pick<CatalogItemView, 'price' | 'compareAtPrice'>): number | null {
  if (item.price === null || item.compareAtPrice === null || item.compareAtPrice <= item.price || item.compareAtPrice <= 0) return null;
  const percent = Math.round((1 - item.price / item.compareAtPrice) * 100);
  return percent >= 1 ? percent : null;
}
