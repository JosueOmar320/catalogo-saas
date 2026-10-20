import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { hexColor } from '@/lib/design/schema-utils';
import { isTimeZone } from '@/lib/business/schedule';
import { saleEndsSchema } from './sale';

/**
 * Campos extensibles del ítem (catalog_items.attributes, JSONB).
 * Hoy: badges manuales y badge personalizado. Mañana: duración, variantes…
 * sin migraciones.
 */
export const MANUAL_BADGES = ['new', 'featured', 'popular'] as const;
export type ManualBadge = (typeof MANUAL_BADGES)[number];

/**
 * Variantes: un grupo de opciones (Tamaño: Chico / Mediano / Grande) con
 * precio, código y disponibilidad propios. Una opción sin precio usa el del
 * producto.
 */
export const variantOptionSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(40),
  price: z.number().min(0).max(99_999_999).nullable().default(null),
  sku: z.string().trim().max(64).nullable().default(null),
  available: z.boolean().default(true),
});

export const MAX_VARIANT_OPTIONS = 20;

export const variantsSchema = z
  .object({
    label: z.string().trim().min(1).max(30),
    options: z.array(variantOptionSchema).min(1).max(MAX_VARIANT_OPTIONS),
  })
  .nullable()
  .default(null);

/**
 * Extras opcionales (Shot extra +$12, Leche de almendra +$8): el cliente elige
 * ninguno o varios (hasta `max`) y su precio se suma al del producto.
 */
export const extraOptionSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(40),
  price: z.number().min(0).max(99_999_999).default(0),
  available: z.boolean().default(true),
});

export const MAX_EXTRA_OPTIONS = 20;

export const extrasSchema = z
  .object({
    label: z.string().trim().min(1).max(30),
    /** Cuántos puede elegir (null = todos los que quiera). */
    max: z.number().int().min(1).max(MAX_EXTRA_OPTIONS).nullable().default(null),
    options: z.array(extraOptionSchema).min(1).max(MAX_EXTRA_OPTIONS),
  })
  .nullable()
  .default(null);

export type ItemExtras = NonNullable<z.output<typeof extrasSchema>>;

/** Horario del día en que se puede pedir (desayunos 7:00–12:00); en la zona horaria del negocio. */
export const orderHoursSchema = z
  .object({ from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })
  .nullable()
  .default(null);

export type OrderHours = NonNullable<z.output<typeof orderHoursSchema>>;

/**
 * Precios por mayoreo: desde cierta cantidad (de la misma línea del pedido),
 * otro precio por unidad. Sólo productos sin opciones.
 */
export const MAX_PRICE_TIERS = 5;
/** Tope de unidades por línea del pedido (igual que el pedido y sus estadísticas). */
export const MAX_TIER_QTY = 99;
export const priceTierSchema = z.object({ minQty: z.number().int().min(2).max(MAX_TIER_QTY), price: z.number().min(0).max(99_999_999) });
export const tiersSchema = z
  .array(priceTierSchema)
  .max(MAX_PRICE_TIERS)
  .refine((list) => list.every((tier, i) => i === 0 || tier.minQty > list[i - 1].minQty), msg('Las cantidades deben ir de menor a mayor'))
  .default([]);
export type PriceTier = z.output<typeof priceTierSchema>;

/** Temporada: el sitio muestra el producto sólo entre esas fechas (vacía = sin límite de ese lado). */
const dateText = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default('');
export const seasonSchema = z
  .object({ from: dateText, until: dateText, timeZone: z.string().max(64).refine(isTimeZone) })
  .refine((s) => (s.from || s.until) && (!s.from || !s.until || s.from <= s.until))
  .nullable()
  .default(null);

export const MAX_PAIRINGS = 4;

/** Precio programado (sólo productos sin opciones): desde ese día vale `price`. */
export const nextPriceSchema = z
  .object({ on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), price: z.number().min(0).max(99_999_999), timeZone: z.string().max(64).refine(isTimeZone) })
  .nullable()
  .default(null);

/** Etiquetas de dieta y alérgenos (se muestran en la ficha y se filtran en el catálogo). */
export const DIET_TAGS = ['vegan', 'vegetarian', 'gluten-free', 'lactose-free', 'sugar-free', 'spicy', 'organic'] as const;
export type DietTag = (typeof DIET_TAGS)[number];

/** Avisa "¡Quedan N!" desde estas existencias o menos. */
export const LOW_STOCK = 5;

export type VariantOption = z.output<typeof variantOptionSchema>;
export type ItemVariants = NonNullable<z.output<typeof variantsSchema>>;

export const itemAttributesSchema = z.object({
  badges: z.array(z.enum(MANUAL_BADGES)).max(3).default([]),
  customBadge: z
    .object({ label: z.string().trim().min(1).max(20), color: hexColor })
    .nullable()
    .default(null),
  variants: variantsSchema,
  extras: extrasSchema,
  orderHours: orderHoursSchema,
  /** Existencias (null = no se controlan). En 0 el producto queda agotado solo. */
  stock: z.number().int().min(0).max(1_000_000).nullable().default(null),
  diet: z.array(z.enum(DIET_TAGS)).max(DIET_TAGS.length).default([]),
  tiers: tiersSchema,
  season: seasonSchema,
  nextPrice: nextPriceSchema,
  /** «Combínalo con»: productos o servicios que se sugieren en la ficha (en este orden). */
  pairings: z.array(z.uuid()).max(MAX_PAIRINGS).default([]),
  /** Fin de la oferta (precio anterior): después se vuelve al precio normal. */
  saleEnds: saleEndsSchema,
});

export type ItemAttributes = z.output<typeof itemAttributesSchema>;

export function parseItemAttributes(raw: unknown): ItemAttributes {
  const value = raw && typeof raw === 'object' ? raw : {};
  const result = itemAttributesSchema.safeParse(value);
  if (result.success) return result.data;
  // Conserva lo válido aunque otra parte esté corrupta.
  const partial = value as Record<string, unknown>;
  return {
    badges: z.array(z.enum(MANUAL_BADGES)).catch([]).parse(partial.badges),
    customBadge: itemAttributesSchema.shape.customBadge.catch(null).parse(partial.customBadge),
    variants: variantsSchema.catch(null).parse(partial.variants),
    extras: extrasSchema.catch(null).parse(partial.extras),
    stock: z.number().int().min(0).max(1_000_000).nullable().catch(null).parse(partial.stock ?? null),
    diet: z.array(z.enum(DIET_TAGS)).catch([]).parse(partial.diet ?? []),
    tiers: tiersSchema.catch([]).parse(partial.tiers ?? []),
    season: seasonSchema.catch(null).parse(partial.season ?? null),
    nextPrice: nextPriceSchema.catch(null).parse(partial.nextPrice ?? null),
    pairings: z.array(z.uuid()).max(MAX_PAIRINGS).catch([]).parse(partial.pairings ?? []),
    orderHours: orderHoursSchema.catch(null).parse(partial.orderHours),
    saleEnds: saleEndsSchema.catch(null).parse(partial.saleEnds),
  };
}
