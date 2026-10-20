import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { CURRENCIES } from '@/lib/catalog/settings';
import { priceText, priceToNumber } from '@/lib/utils/validation';
import { uploadedImageSchema } from '@/features/media/schema';
import { DIET_TAGS, MANUAL_BADGES, MAX_EXTRA_OPTIONS, MAX_PAIRINGS, MAX_PRICE_TIERS, MAX_VARIANT_OPTIONS } from '@/lib/catalog/item-attributes';
import { isTimeZone } from '@/lib/business/schedule';
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
    /** Costo (privado: no se publica; para el margen). */
    cost: priceText,
    /** Precio programado: desde ese día ("" = sin programar) vale `nextPrice`. */
    nextPriceOn: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    nextPrice: priceText,
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
    /** Último día de la oferta ("2026-10-31", vacío = sin fecha) y la zona horaria de quien la programa. */
    saleEndsOn: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    saleTimeZone: z.string().max(64),
    /** Opciones con precio propio (tamaños, sabores…). Con `variantsEnabled` en false se ignoran. */
    variantsEnabled: z.boolean(),
    variantsLabel: z.string().trim().max(30),
    variants: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          name: z.string().trim().max(40),
          price: priceText,
          sku: z.string().trim().max(64),
          available: z.boolean(),
        }),
      )
      .max(MAX_VARIANT_OPTIONS),
    /** Extras opcionales con precio que se suma (Shot extra +$12). Con `extrasEnabled` en false se ignoran. */
    extrasEnabled: z.boolean(),
    extrasLabel: z.string().trim().max(30),
    /** Cuántos puede elegir el cliente ("" = sin límite). */
    extrasMax: z.union([z.literal(''), z.string().regex(/^\d{1,2}$/, msg('Usa un número, ej. 2'))]),
    extras: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          name: z.string().trim().max(40),
          price: priceText,
          available: z.boolean(),
        }),
      )
      .max(MAX_EXTRA_OPTIONS),
    /** Existencias ("" = no se controlan). */
    stock: z.union([z.literal(''), z.string().trim().regex(/^\d{1,7}$/, msg('Usa un número entero, ej. 12'))]),
    diet: z.array(z.enum(DIET_TAGS)).max(DIET_TAGS.length),
    /** Temporada: se ve en el sitio sólo entre estas fechas ("" = sin límite de ese lado). */
    seasonFrom: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    seasonUntil: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    /** «Combínalo con»: hasta 4 productos o servicios sugeridos en la ficha. */
    pairings: z.array(z.uuid()).max(MAX_PAIRINGS, msg('Elige hasta 4')),
    /** Precios por mayoreo: desde cuántas piezas y a qué precio cada una. */
    tiers: z.array(z.object({ minQty: z.union([z.literal(''), z.string().trim().regex(/^\d{1,2}$/, msg('Usa un número entero, ej. 12'))]), price: priceText })).max(MAX_PRICE_TIERS),
    /** Sólo se puede pedir en este horario del día (desayunos). */
    orderHoursEnabled: z.boolean(),
    orderHoursFrom: z.string(),
    orderHoursTo: z.string(),
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
  )
  .refine((v) => !v.variantsEnabled || v.variantsLabel.trim() !== '', { path: ['variantsLabel'], message: msg('Escribe qué eligen tus clientes (p. ej. Tamaño)') })
  .refine((v) => !v.variantsEnabled || v.variants.some((o) => o.name.trim() !== ''), { path: ['variants'], message: msg('Agrega al menos una opción') })
  .refine((v) => !v.extrasEnabled || v.extrasLabel.trim() !== '', { path: ['extrasLabel'], message: msg('Escribe cómo se llaman (p. ej. Extras)') })
  .refine((v) => !v.extrasEnabled || v.extras.some((o) => o.name.trim() !== ''), { path: ['extras'], message: msg('Agrega al menos un extra') })
  .refine((v) => v.tiers.every((tier) => (tier.minQty === '' && !tier.price?.trim()) || (tier.minQty !== '' && Number(tier.minQty) >= 2 && priceToNumber(tier.price) !== null)), {
    path: ['tiers'],
    message: msg('Cada fila necesita una cantidad (2 o más) y su precio'),
  })
  .refine((v) => new Set(v.tiers.filter((tier) => tier.minQty !== '').map((tier) => Number(tier.minQty))).size === v.tiers.filter((tier) => tier.minQty !== '').length, {
    path: ['tiers'],
    message: msg('Hay dos filas con la misma cantidad'),
  })
  .refine((v) => (v.nextPriceOn === '') === !v.nextPrice?.trim(), { path: ['nextPrice'], message: msg('Escribe el nuevo precio y desde cuándo vale') })
  .refine((v) => !v.seasonFrom || !v.seasonUntil || v.seasonFrom <= v.seasonUntil, { path: ['seasonUntil'], message: msg('Debe ser igual o posterior a la fecha de inicio') })
  .refine((v) => !v.orderHoursEnabled || (TIME.test(v.orderHoursFrom) && TIME.test(v.orderHoursTo) && v.orderHoursFrom !== v.orderHoursTo), {
    path: ['orderHoursTo'],
    message: msg('Elige una hora de inicio y otra de fin distintas'),
  });

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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
    variants: values.type === 'product' ? formVariants(values) : null,
    extras: values.type === 'product' ? formExtras(values) : null,
    orderHours: values.type === 'product' ? formOrderHours(values) : null,
    stock: values.type === 'product' && values.stock !== '' ? Number(values.stock) : null,
    diet: values.diet,
    tiers: values.type === 'product' && !values.variantsEnabled ? formTiers(values.tiers) : [],
    // La zona horaria es la de quien edita (igual que el fin de la oferta).
    season: (values.seasonFrom || values.seasonUntil) && isTimeZone(values.saleTimeZone) ? { from: values.seasonFrom, until: values.seasonUntil, timeZone: values.saleTimeZone } : null,
    pairings: [...new Set(values.pairings)].slice(0, MAX_PAIRINGS),
    nextPrice: formNextPrice(values),
    saleEnds: values.saleEndsOn && priceToNumber(values.compareAtPrice) !== null && isTimeZone(values.saleTimeZone) ? { on: values.saleEndsOn, timeZone: values.saleTimeZone } : null,
    customBadge: values.customBadgeLabel ? { label: values.customBadgeLabel, color: values.customBadgeColor } : null,
    values: values.attributeValues,
  };
}

/** Precio programado del formulario (sólo productos sin opciones, con fecha, precio y zona horaria válidos). */
export function formNextPrice(values: Pick<z.output<typeof itemFormSchema>, 'type' | 'variantsEnabled' | 'nextPriceOn' | 'nextPrice' | 'saleTimeZone'>) {
  const price = priceToNumber(values.nextPrice);
  return values.type === 'product' && !values.variantsEnabled && values.nextPriceOn && price !== null && isTimeZone(values.saleTimeZone) ? { on: values.nextPriceOn, price, timeZone: values.saleTimeZone } : null;
}

/** Filas de mayoreo → atributos guardados: completas, de menor a mayor cantidad. */
export function formTiers(rows: z.output<typeof itemFormSchema>['tiers']) {
  return rows
    .flatMap((row) => {
      const price = priceToNumber(row.price);
      return row.minQty !== '' && Number(row.minQty) >= 2 && price !== null ? [{ minQty: Number(row.minQty), price }] : [];
    })
    .sort((a, b) => a.minQty - b.minQty)
    .slice(0, MAX_PRICE_TIERS);
}

/** Extras del formulario → atributos guardados (las filas sin nombre se descartan; sin precio = gratis). */
export function formExtras(values: Pick<z.output<typeof itemFormSchema>, 'extrasEnabled' | 'extrasLabel' | 'extrasMax' | 'extras'>) {
  const options = values.extras.filter((o) => o.name.trim() !== '');
  if (!values.extrasEnabled || options.length === 0) return null;
  const max = values.extrasMax ? Math.min(Math.max(Number(values.extrasMax), 1), options.length) : null;
  return {
    label: values.extrasLabel.trim(),
    max,
    options: options.map((o) => ({ id: o.id, name: o.name.trim(), price: priceToNumber(o.price) ?? 0, available: o.available })),
  };
}

export function formOrderHours(values: Pick<z.output<typeof itemFormSchema>, 'orderHoursEnabled' | 'orderHoursFrom' | 'orderHoursTo'>) {
  return values.orderHoursEnabled && TIME.test(values.orderHoursFrom) && TIME.test(values.orderHoursTo) ? { from: values.orderHoursFrom, to: values.orderHoursTo } : null;
}

/** Opciones del formulario → atributos guardados (las filas sin nombre se descartan). */
export function formVariants(values: Pick<z.output<typeof itemFormSchema>, 'variantsEnabled' | 'variantsLabel' | 'variants'>) {
  const options = values.variants.filter((o) => o.name.trim() !== '');
  if (!values.variantsEnabled || options.length === 0) return null;
  return {
    label: values.variantsLabel.trim(),
    options: options.map((o) => ({ id: o.id, name: o.name.trim(), price: priceToNumber(o.price), sku: o.sku.trim() || null, available: o.available })),
  };
}

