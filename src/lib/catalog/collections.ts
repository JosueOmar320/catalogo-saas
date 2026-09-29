import { z } from 'zod';
import { fieldFactory } from '@/lib/design/schema-utils';
import type { CatalogItemView } from './view-model';

/**
 * Colecciones: fuentes dinámicas de ítems ("Destacados", "Ofertas",
 * "Marca = X"…) para secciones web y bloques PDF. Evitan elegir a mano.
 */
export const COLLECTION_SOURCES = ['all', 'featured', 'new', 'sale', 'popular', 'latest', 'category', 'attribute', 'manual'] as const;
export type CollectionSource = (typeof COLLECTION_SOURCES)[number];

export const COLLECTION_LABELS: Record<CollectionSource, string> = {
  all: 'Todos',
  featured: 'Destacados',
  new: 'Nuevos',
  sale: 'En oferta',
  popular: 'Populares',
  latest: 'Más recientes',
  category: 'De una categoría',
  attribute: 'Por atributo (marca, material…)',
  manual: 'Elegidos a mano',
};

export const SORT_OPTIONS = ['custom', 'name', 'priceAsc', 'priceDesc', 'newest', 'featured'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  custom: 'Orden personalizado',
  name: 'Nombre (A–Z)',
  priceAsc: 'Precio: menor a mayor',
  priceDesc: 'Precio: mayor a menor',
  newest: 'Más recientes',
  featured: 'Destacados primero',
};

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  return z.object({
    source: f(z.enum(COLLECTION_SOURCES), 'all'),
    itemType: f(z.enum(['any', 'product', 'service']), 'any'),
    categoryId: f(z.string().max(64), ''),
    attributeId: f(z.string().max(40), ''),
    attributeValue: f(z.string().max(80), ''),
    itemIds: f(z.array(z.string().max(64)).max(200), []),
    /** 0 = sin límite. */
    limit: f(z.number().int().min(0).max(500), 0),
    sort: f(z.enum(SORT_OPTIONS), 'custom'),
  });
}

export const collectionSchema = build(false);
export const lenientCollectionSchema = build(true);
export type Collection = z.output<typeof collectionSchema>;

export function collection(partial: Record<string, unknown> = {}): Collection {
  return lenientCollectionSchema.parse(partial);
}

export function sortItems(items: CatalogItemView[], sort: SortOption): CatalogItemView[] {
  const list = [...items];
  const price = (i: CatalogItemView) => i.price ?? Number.POSITIVE_INFINITY;
  switch (sort) {
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    case 'priceAsc':
      return list.sort((a, b) => price(a) - price(b));
    case 'priceDesc':
      return list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case 'newest':
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'featured':
      return list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    default:
      return list;
  }
}

/** Ítems de una colección, filtrados, ordenados y (opcionalmente) limitados. */
export function resolveCollection(c: Collection, items: CatalogItemView[], { ignoreLimit = false } = {}): CatalogItemView[] {
  const pool = c.itemType === 'any' ? items : items.filter((i) => i.type === c.itemType);
  let result: CatalogItemView[];
  switch (c.source) {
    case 'featured':
      result = pool.filter((i) => i.isFeatured);
      break;
    case 'new':
      result = pool.filter((i) => i.badges.includes('new'));
      break;
    case 'popular':
      result = pool.filter((i) => i.badges.includes('popular'));
      break;
    case 'sale':
      result = pool.filter((i) => i.compareAtLabel !== null);
      break;
    case 'latest':
      result = sortItems(pool, 'newest');
      break;
    case 'category':
      result = pool.filter((i) => i.categoryId === c.categoryId);
      break;
    case 'attribute': {
      const wanted = c.attributeValue.trim().toLowerCase();
      result = pool.filter((i) => {
        const v = i.attributes[c.attributeId];
        if (v === undefined) return false;
        if (!wanted) return true;
        return (Array.isArray(v) ? v : [String(v)]).some((x) => String(x).toLowerCase() === wanted);
      });
      break;
    }
    case 'manual': {
      const byId = new Map(pool.map((i) => [i.id, i]));
      result = c.itemIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
      break;
    }
    default:
      result = pool;
  }
  if (c.source !== 'manual' && c.source !== 'latest') result = sortItems(result, c.sort);
  return ignoreLimit || c.limit === 0 ? result : result.slice(0, c.limit);
}
