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

export type VariantOption = z.output<typeof variantOptionSchema>;
export type ItemVariants = NonNullable<z.output<typeof variantsSchema>>;

export const itemAttributesSchema = z.object({
  badges: z.array(z.enum(MANUAL_BADGES)).max(3).default([]),
  customBadge: z
    .object({ label: z.string().trim().min(1).max(20), color: hexColor })
    .nullable()
    .default(null),
  variants: variantsSchema,
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
    saleEnds: saleEndsSchema.catch(null).parse(partial.saleEnds),
  };
}
