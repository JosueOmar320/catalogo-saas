import { z } from 'zod';
import { fieldFactory } from '@/lib/design/schema-utils';
import { SORT_OPTIONS } from './collections-core';

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

export { SORT_OPTIONS, SORT_LABELS, sortItems, resolveCollection, type SortOption } from './collections-core';
