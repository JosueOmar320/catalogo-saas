import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { CURRENCIES } from '@/lib/catalog/settings';
import { priceText, priceToNumber } from '@/lib/utils/validation';
import { uploadedImageSchema } from '@/features/media/schema';
import { MANUAL_BADGES } from '@/lib/catalog/item-attributes';
import { hexColor } from '@/lib/design/schema-utils';

export const ITEM_TYPES = ['product', 'service'] as const;

export const ITEM_TYPE_LABELS = {
  product: { singular: msg('Producto'), plural: msg('Productos'), newLabel: msg('Nuevo producto') },
  service: { singular: msg('Servicio'), plural: msg('Servicios'), newLabel: msg('Nuevo servicio') },
} as const;

/** Esquema del formulario de ítem (valores tal como los maneja el formulario). */
export const itemFormSchema = z
  .object({
    type: z.enum(ITEM_TYPES),
    name: z.string().trim().min(1, msg('Escribe un nombre')).max(160),
    categoryId: z.union([z.literal(''), z.uuid()]),
    shortDescription: z.string().trim().max(300, msg('Máximo 300 caracteres')),
    description: z.string().trim().max(5000),
    price: priceText,
    compareAtPrice: priceText,
    currency: z.enum(CURRENCIES),
    priceNote: z.string().trim().max(40),
    sku: z.string().trim().max(64),
    isAvailable: z.boolean(),
    isFeatured: z.boolean(),
    isVisible: z.boolean(),
    tags: z.array(z.string().trim().min(1).max(30)).max(15),
    images: z.array(uploadedImageSchema).max(20),
    badges: z.array(z.enum(MANUAL_BADGES)).max(3),
    customBadgeLabel: z.string().trim().max(20),
    customBadgeColor: hexColor,
    /** Valores de atributos personalizados (se validan contra las definiciones en el servidor). */
    attributeValues: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.array(z.string().max(120)).max(20)])),
  })
  .refine(
    (v) => {
      const price = priceToNumber(v.price);
      const compare = priceToNumber(v.compareAtPrice);
      return compare === null || (price !== null && compare > price);
    },
    { path: ['compareAtPrice'], message: msg('Debe ser mayor que el precio actual') },
  );

export type ItemFormValues = z.input<typeof itemFormSchema>;

/** Traduce los valores del formulario a columnas de catalog_items. */
export function itemFormToRow(values: z.output<typeof itemFormSchema>) {
  return {
    type: values.type,
    name: values.name,
    category_id: values.categoryId || null,
    short_description: values.shortDescription || null,
    description: values.description || null,
    price: priceToNumber(values.price),
    compare_at_price: priceToNumber(values.compareAtPrice),
    currency: values.currency,
    price_note: values.priceNote || null,
    sku: values.sku || null,
    is_available: values.isAvailable,
    is_featured: values.isFeatured,
    is_visible: values.isVisible,
    tags: values.tags,
  };
}

/** Campos que viven en catalog_items.attributes (JSONB extensible). */
export function itemFormToAttributes(values: z.output<typeof itemFormSchema>) {
  return {
    badges: values.badges.filter((b) => b !== 'featured' || values.isFeatured),
    customBadge: values.customBadgeLabel ? { label: values.customBadgeLabel, color: values.customBadgeColor } : null,
    values: values.attributeValues,
  };
}
