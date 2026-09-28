import { z } from 'zod';
import { hexColor } from '@/lib/design/schema-utils';

/**
 * Campos extensibles del ítem (catalog_items.attributes, JSONB).
 * Hoy: badges manuales y badge personalizado. Mañana: duración, variantes…
 * sin migraciones.
 */
export const MANUAL_BADGES = ['new', 'featured', 'popular'] as const;
export type ManualBadge = (typeof MANUAL_BADGES)[number];

export const itemAttributesSchema = z.object({
  badges: z.array(z.enum(MANUAL_BADGES)).max(3).default([]),
  customBadge: z
    .object({ label: z.string().trim().min(1).max(20), color: hexColor })
    .nullable()
    .default(null),
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
  };
}
