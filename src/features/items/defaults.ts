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
    type: item.type,
    name: item.name,
    categoryId: item.category_id ?? '',
    shortDescription: item.short_description ?? '',
    description: item.description ?? '',
    price: priceString(item.price),
    compareAtPrice: priceString(item.compare_at_price),
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
