import type { CatalogCategoryView, CatalogItemView } from '@/lib/catalog/view-model';
import type { ItemType } from '@/types/database';

export type CatalogFilters = {
  query: string;
  categoryId: string | 'all';
  type: ItemType | 'all';
  onlyAvailable: boolean;
};

export const EMPTY_FILTERS: CatalogFilters = { query: '', categoryId: 'all', type: 'all', onlyAvailable: false };

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Búsqueda sin acentos por nombre, descripción, código y etiquetas. */
export function filterItems(items: CatalogItemView[], filters: CatalogFilters): CatalogItemView[] {
  const terms = normalize(filters.query.trim()).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) return false;
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.onlyAvailable && !item.isAvailable) return false;
    if (terms.length === 0) return true;
    const haystack = normalize([item.name, item.shortDescription, item.sku, ...item.tags].filter(Boolean).join(' '));
    return terms.every((term) => haystack.includes(term));
  });
}

export type CatalogGroup = { id: string; title: string | null; description: string | null; items: CatalogItemView[] };

/** Agrupa por categoría respetando el orden del administrador. Lo usa también el PDF. */
export function groupByCategory(items: CatalogItemView[], categories: CatalogCategoryView[]): CatalogGroup[] {
  const byCategory = new Map<string, CatalogItemView[]>();
  const uncategorized: CatalogItemView[] = [];
  for (const item of items) {
    if (item.categoryId) byCategory.set(item.categoryId, [...(byCategory.get(item.categoryId) ?? []), item]);
    else uncategorized.push(item);
  }
  const groups: CatalogGroup[] = categories
    .filter((c) => byCategory.has(c.id))
    .map((c) => ({ id: c.id, title: c.name, description: c.description, items: byCategory.get(c.id)! }));
  if (uncategorized.length > 0) {
    groups.push({ id: 'uncategorized', title: groups.length > 0 ? 'Otros' : null, description: null, items: uncategorized });
  }
  return groups;
}
