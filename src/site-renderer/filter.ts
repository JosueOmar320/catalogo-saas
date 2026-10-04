import type { CatalogCategoryView, CatalogItemView } from '@/lib/catalog/view-model';
import type { AttributeDef, AttributeValue } from '@/lib/catalog/attributes';
import type { ItemType } from '@/types/database';

export type BadgeFilter = 'all' | 'featured' | 'new' | 'sale' | 'popular';

export type CatalogFilters = {
  query: string;
  categoryId: string | 'all';
  type: ItemType | 'all';
  onlyAvailable: boolean;
  priceMin: number | null;
  priceMax: number | null;
  badge: BadgeFilter;
  /** attributeId → valor elegido. */
  attrs: Record<string, string>;
};

export const EMPTY_FILTERS: CatalogFilters = { query: '', categoryId: 'all', type: 'all', onlyAvailable: false, priceMin: null, priceMax: null, badge: 'all', attrs: {} };

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const attrStrings = (value: AttributeValue | undefined): string[] => {
  if (value === undefined) return [];
  if (typeof value === 'boolean') return [value ? 'Sí' : 'No'];
  return Array.isArray(value) ? value : [String(value)];
};

function matchesBadge(item: CatalogItemView, badge: BadgeFilter): boolean {
  switch (badge) {
    case 'featured':
      return item.isFeatured;
    case 'sale':
      return item.compareAtLabel !== null;
    case 'new':
    case 'popular':
      return item.badges.includes(badge);
    default:
      return true;
  }
}

/**
 * Texto de búsqueda normalizado de cada ítem, calculado UNA vez por ítem (y
 * no en cada tecla). WeakMap: se libera solo cuando el ítem deja de existir.
 */
const searchText = new WeakMap<CatalogItemView, string>();
function haystackOf(item: CatalogItemView): string {
  let text = searchText.get(item);
  if (text === undefined) {
    const attrText = Object.values(item.attributes).flatMap(attrStrings);
    text = normalize([item.name, item.shortDescription, item.sku, ...item.tags, ...attrText].filter(Boolean).join(' '));
    searchText.set(item, text);
  }
  return text;
}

/** Búsqueda sin acentos por nombre, descripción, código, etiquetas y atributos; más filtros. */
export function filterItems(items: CatalogItemView[], filters: CatalogFilters): CatalogItemView[] {
  const terms = normalize(filters.query.trim()).split(/\s+/).filter(Boolean);
  const attrFilters = Object.entries(filters.attrs).filter(([, v]) => v !== '');
  return items.filter((item) => {
    if (filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) return false;
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.onlyAvailable && !item.isAvailable) return false;
    if (filters.priceMin !== null && (item.price === null || item.price < filters.priceMin)) return false;
    if (filters.priceMax !== null && (item.price === null || item.price > filters.priceMax)) return false;
    if (!matchesBadge(item, filters.badge)) return false;
    for (const [id, wanted] of attrFilters) {
      if (!attrStrings(item.attributes[id]).includes(wanted)) return false;
    }
    if (terms.length === 0) return true;
    const haystack = haystackOf(item);
    return terms.every((term) => haystack.includes(term));
  });
}

/** Valores posibles de un atributo filtrable (opciones definidas o valores presentes). */
export function attributeFilterOptions(def: AttributeDef, items: CatalogItemView[]): string[] {
  if (def.type === 'boolean') return ['Sí', 'No'];
  const present = new Set(items.flatMap((i) => attrStrings(i.attributes[def.id])));
  const base = def.options.length > 0 ? def.options.filter((o) => present.has(o)) : [...present];
  return def.type === 'number' ? base.sort((a, b) => Number(a) - Number(b)) : base;
}

export type CatalogGroup = { id: string; title: string | null; description: string | null; items: CatalogItemView[] };

/** Agrupa por categoría respetando el orden del administrador. Lo usa también el PDF. */
export function groupByCategory(items: CatalogItemView[], categories: CatalogCategoryView[]): CatalogGroup[] {
  const byCategory = new Map<string, CatalogItemView[]>();
  const uncategorized: CatalogItemView[] = [];
  for (const item of items) {
    if (!item.categoryId) {
      uncategorized.push(item);
      continue;
    }
    // push (no copiar el arreglo en cada ítem: eso era O(n²) por categoría).
    const list = byCategory.get(item.categoryId);
    if (list) list.push(item);
    else byCategory.set(item.categoryId, [item]);
  }
  const groups: CatalogGroup[] = categories
    .filter((c) => byCategory.has(c.id))
    .map((c) => ({ id: c.id, title: c.name, description: c.description, items: byCategory.get(c.id)! }));
  if (uncategorized.length > 0) {
    groups.push({ id: 'uncategorized', title: groups.length > 0 ? 'Otros' : null, description: null, items: uncategorized });
  }
  return groups;
}
