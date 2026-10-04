import { env } from '@/lib/env';
import { formatPrice } from '@/lib/utils/format';
import { publicStorageUrl } from '@/lib/utils/storage';
import type { ItemType, Tables } from '@/types/database';
import { parseAttributeValues, type AttributeDef, type AttributeValues } from './attributes';
import { parseItemAttributes, type ItemAttributes } from './item-attributes';
import type { PriceFormat } from './settings';

/**
 * Vistas de ítems y categorías (serializables, sin funciones). Las comparten
 * el sitio web, la preview del builder y el PDF.
 */
export type CatalogImageView = {
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  alt: string;
};

export { discountPercent } from './price';

export type CatalogItemView = {
  id: string;
  slug: string;
  type: ItemType;
  name: string;
  shortDescription: string | null;
  description: string | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  priceLabel: string | null;
  compareAtLabel: string | null;
  priceNote: string | null;
  sku: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  tags: string[];
  categoryId: string | null;
  images: CatalogImageView[];
  badges: ItemAttributes['badges'];
  customBadge: ItemAttributes['customBadge'];
  /** Valores de atributos personalizados (por id de atributo). */
  attributes: AttributeValues;
  createdAt: string;
  /** URL absoluta (para mensajes de WhatsApp y SEO). */
  url: string;
};

export type CatalogCategoryView = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

type ImageInput = Pick<Tables<'catalog_item_images'>, 'storage_path' | 'thumb_path' | 'width' | 'height' | 'alt' | 'position'>;
export type ItemInput = Omit<Tables<'catalog_items'>, 'business_id' | 'catalog_id' | 'attributes'> & {
  attributes?: unknown;
  images: ImageInput[];
};
export type CategoryInput = Pick<Tables<'categories'>, 'id' | 'name' | 'description' | 'image_path' | 'position'>;

export function catalogUrl(businessSlug: string): string {
  return `${env.siteUrl}/catalogo/${businessSlug}`;
}

export function itemUrl(businessSlug: string, itemSlug: string): string {
  return `${catalogUrl(businessSlug)}/p/${itemSlug}`;
}

export function mapCategories(categories: CategoryInput[]): CatalogCategoryView[] {
  return [...categories]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, description: c.description, imageUrl: publicStorageUrl(c.image_path) }));
}

/** Ítems ordenados por categoría (orden del admin) y luego por posición. */
type MapOptions = { locale: string; attributeDefs?: AttributeDef[]; priceFormat?: PriceFormat };

export function mapItems(items: ItemInput[], categories: CatalogCategoryView[], businessSlug: string, options: MapOptions): CatalogItemView[] {
  const order = new Map(categories.map((c, index) => [c.id, index]));
  const rank = (id: string | null) => (id ? (order.get(id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER);
  return items
    .map((item) => toItemView(item, businessSlug, options))
    .sort((a, b) => rank(a.categoryId) - rank(b.categoryId));
}

function toItemView(item: ItemInput, businessSlug: string, { locale, attributeDefs = [], priceFormat }: MapOptions): CatalogItemView {
  const price = item.price === null ? null : Number(item.price);
  const compareAt = item.compare_at_price === null ? null : Number(item.compare_at_price);
  const attributes = parseItemAttributes(item.attributes);
  const images = [...item.images]
    .sort((a, b) => a.position - b.position)
    .flatMap((image) => {
      const url = publicStorageUrl(image.storage_path);
      if (!url) return [];
      return [{ url, thumbUrl: publicStorageUrl(image.thumb_path) ?? url, width: image.width, height: image.height, alt: image.alt || item.name }];
    });

  return {
    id: item.id,
    slug: item.slug,
    type: item.type,
    name: item.name,
    shortDescription: item.short_description,
    description: item.description,
    price,
    compareAtPrice: compareAt,
    currency: item.currency,
    priceLabel: price === null ? null : formatPrice(price, item.currency, locale, priceFormat),
    compareAtLabel: compareAt !== null && price !== null && compareAt > price ? formatPrice(compareAt, item.currency, locale, { ...priceFormat, prefix: '' }) : null,
    priceNote: item.price_note,
    sku: item.sku,
    isAvailable: item.is_available,
    isFeatured: item.is_featured,
    tags: item.tags ?? [],
    categoryId: item.category_id,
    images,
    badges: attributes.badges,
    customBadge: attributes.customBadge,
    attributes: parseAttributeValues((item.attributes as { values?: unknown } | null)?.values, attributeDefs),
    createdAt: item.created_at,
    url: itemUrl(businessSlug, item.slug),
  };
}
