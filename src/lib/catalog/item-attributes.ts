import { z } from 'zod';
import { hexColor } from '@/lib/design/schema-utils';
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
    orderHours: orderHoursSchema.catch(null).parse(partial.orderHours),
    saleEnds: saleEndsSchema.catch(null).parse(partial.saleEnds),
  };
}
