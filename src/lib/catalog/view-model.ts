import { env } from '@/lib/env';
import { formatPrice } from '@/lib/utils/format';
import { publicStorageUrl } from '@/lib/utils/storage';
import type { ItemType, Tables } from '@/types/database';
import { parseAttributeValues, type AttributeDef, type AttributeValues } from './attributes';
import { hasAvailableOption, optionPrice, variantPriceSummary } from './variants';
import { isSaleOver } from './sale';
import { parseItemAttributes, type DietTag, type ItemAttributes } from './item-attributes';
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
  /** Opciones (tamaños, sabores…) con su precio ya formateado; null si no tiene. */
  variants: CatalogVariantsView | null;
  /** Extras opcionales con su precio ("+$12" ya formateado); null si no tiene. */
  extras: CatalogExtrasView | null;
  /** Existencias (null = no se controlan). */
  stock: number | null;
  diet: DietTag[];
  /** Precios por mayoreo (de menor a mayor cantidad), con el precio formateado; vacío si no tiene. */
  tiers: { minQty: number; price: number; priceLabel: string }[];
  /** Horario del día en que se puede pedir (desayunos); null = siempre. */
  orderHours: { from: string; to: string } | null;
  /** Último día de la oferta ("2026-10-31") mientras sigue vigente; null si no tiene fecha. */
  saleEndsOn: string | null;
};

export type CatalogExtrasView = {
  label: string;
  max: number | null;
  options: { id: string; name: string; price: number; priceLabel: string | null; available: boolean }[];
};

export type CatalogVariantsView = {
  label: string;
  options: { id: string; name: string; price: number | null; priceLabel: string | null; sku: string | null; available: boolean }[];
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
type MapOptions = { locale: string; attributeDefs?: AttributeDef[]; priceFormat?: PriceFormat; /** Para decidir si una oferta ya terminó (pruebas). */ now?: Date };

export function mapItems(items: ItemInput[], categories: CatalogCategoryView[], businessSlug: string, options: MapOptions): CatalogItemView[] {
  const order = new Map(categories.map((c, index) => [c.id, index]));
  const rank = (id: string | null) => (id ? (order.get(id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER);
  return items
    .map((item) => toItemView(item, businessSlug, options))
    .sort((a, b) => rank(a.categoryId) - rank(b.categoryId));
}

function toItemView(item: ItemInput, businessSlug: string, { locale, attributeDefs = [], priceFormat, now = new Date() }: MapOptions): CatalogItemView {
  const price = item.price === null ? null : Number(item.price);
  const attributes = parseItemAttributes(item.attributes);
  // Una oferta vencida vuelve sola al precio normal: el anterior deja de mostrarse.
  const saleOver = isSaleOver(attributes.saleEnds, now);
  const compareAt = item.compare_at_price === null || saleOver ? null : Number(item.compare_at_price);
  const format = (value: number) => formatPrice(value, item.currency, locale, priceFormat);
  // Con opciones, el precio visible es el menor (con "desde" si varían).
  const summary = variantPriceSummary(price, attributes.variants);
  const shownPrice = summary.price;
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
    price: shownPrice,
    compareAtPrice: attributes.variants ? null : compareAt,
    currency: item.currency,
    priceLabel: shownPrice === null ? null : format(shownPrice),
    compareAtLabel: !attributes.variants && compareAt !== null && price !== null && compareAt > price ? formatPrice(compareAt, item.currency, locale, { ...priceFormat, prefix: '' }) : null,
    priceNote: item.price_note || (summary.from ? 'desde' : null),
    sku: item.sku,
    // Agotado si así lo marcó el dueño, si se agotaron todas las opciones o si las existencias llegaron a 0.
    isAvailable: item.is_available && hasAvailableOption(attributes.variants) && attributes.stock !== 0,
    isFeatured: item.is_featured,
    tags: item.tags ?? [],
    categoryId: item.category_id,
    images,
    badges: attributes.badges,
    customBadge: attributes.customBadge,
    attributes: parseAttributeValues((item.attributes as { values?: unknown } | null)?.values, attributeDefs),
    createdAt: item.created_at,
    url: itemUrl(businessSlug, item.slug),
    variants: attributes.variants && {
      label: attributes.variants.label,
      options: attributes.variants.options.map((o) => {
        const value = optionPrice(o, price);
        return { id: o.id, name: o.name, price: value, priceLabel: value === null ? null : format(value), sku: o.sku, available: o.available };
      }),
    },
    extras: attributes.extras && {
      label: attributes.extras.label,
      max: attributes.extras.max,
      options: attributes.extras.options.map((o) => ({ id: o.id, name: o.name, price: o.price, priceLabel: o.price > 0 ? format(o.price) : null, available: o.available })),
    },
    orderHours: attributes.orderHours,
    stock: attributes.stock,
    diet: attributes.diet,
    // Sólo productos sin opciones y con precio: el mayoreo baja el precio por unidad.
    tiers: item.type === 'product' && !attributes.variants && price !== null ? attributes.tiers.map((tier) => ({ ...tier, priceLabel: format(tier.price) })) : [],
    saleEndsOn: !attributes.variants && compareAt !== null && price !== null && compareAt > price ? (attributes.saleEnds?.on ?? null) : null,
  };
}
