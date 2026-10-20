import type { AdminItem } from '@/features/catalog/queries';
import type { ItemType, Tables } from '@/types/database';
import { parseItemAttributes } from '@/lib/catalog/item-attributes';
import type { ItemFormValues } from './schema';

export function emptyItemValues(type: ItemType, currency: ItemFormValues['currency']): ItemFormValues {
  return {
    type,
    name: '',
    categoryId: '',
    shortDescription: '',
    description: '',
    price: '',
    compareAtPrice: '',
    saleEndsOn: '',
    saleTimeZone: '',
    currency,
    priceNote: '',
    sku: '',
    isAvailable: true,
    isFeatured: false,
    isVisible: true,
    tags: [],
    images: [],
    badges: [],
    customBadgeLabel: '',
    customBadgeColor: '#0F766E',
    attributeValues: {},
    variantsEnabled: false,
    variantsLabel: '',
    variants: [],
    extrasEnabled: false,
    extrasLabel: '',
    extrasMax: '',
    extras: [],
    stock: '',
    diet: [],
    tiers: [],
    orderHoursEnabled: false,
    orderHoursFrom: '07:00',
    orderHoursTo: '12:00',
  };
}

const priceString = (value: number | null) => (value === null ? '' : String(Number(value)));

export function itemToFormValues(item: Omit<AdminItem, 'images'> & { images: Tables<'catalog_item_images'>[] }): ItemFormValues {
  const attributes = parseItemAttributes(item.attributes);
  return {
    badges: attributes.badges,
    customBadgeLabel: attributes.customBadge?.label ?? '',
    customBadgeColor: attributes.customBadge?.color ?? '#0F766E',
    attributeValues: ((item.attributes as { values?: ItemFormValues['attributeValues'] } | null)?.values ?? {}) as ItemFormValues['attributeValues'],
    variantsEnabled: attributes.variants !== null,
    variantsLabel: attributes.variants?.label ?? '',
    variants: (attributes.variants?.options ?? []).map((o) => ({ id: o.id, name: o.name, price: priceString(o.price), sku: o.sku ?? '', available: o.available })),
    extrasEnabled: attributes.extras !== null,
    extrasLabel: attributes.extras?.label ?? '',
    extrasMax: attributes.extras?.max ? String(attributes.extras.max) : '',
    extras: (attributes.extras?.options ?? []).map((o) => ({ id: o.id, name: o.name, price: o.price ? priceString(o.price) : '', available: o.available })),
    stock: attributes.stock === null ? '' : String(attributes.stock),
    diet: attributes.diet,
    tiers: attributes.tiers.map((tier) => ({ minQty: String(tier.minQty), price: String(tier.price) })),
    orderHoursEnabled: attributes.orderHours !== null,
    orderHoursFrom: attributes.orderHours?.from ?? '07:00',
    orderHoursTo: attributes.orderHours?.to ?? '12:00',
    type: item.type,
    name: item.name,
    categoryId: item.category_id ?? '',
    shortDescription: item.short_description ?? '',
    description: item.description ?? '',
    price: priceString(item.price),
    compareAtPrice: priceString(item.compare_at_price),
    saleEndsOn: attributes.saleEnds?.on ?? '',
    saleTimeZone: attributes.saleEnds?.timeZone ?? '',
    currency: item.currency as ItemFormValues['currency'],
    priceNote: item.price_note ?? '',
    sku: item.sku ?? '',
    isAvailable: item.is_available,
    isFeatured: item.is_featured,
    isVisible: item.is_visible,
    tags: item.tags,
    images: item.images.map((image) => ({
      id: image.id,
      path: image.storage_path,
      thumbPath: image.thumb_path,
      width: image.width,
      height: image.height,
      sizeBytes: image.size_bytes,
      mimeType: image.mime_type as 'image/jpeg' | 'image/png' | 'image/webp' | null,
      alt: image.alt ?? '',
    })),
  };
}
