import { z } from 'zod';

/**
 * Único punto de verdad sobre qué permite cada plan. Los valores vienen de la
 * tabla `plans` (limits/features JSONB); aquí sólo se interpretan.
 * La base de datos también aplica los límites críticos con triggers.
 */
const limitsSchema = z.object({
  max_catalogs: z.number().int().nullable().default(1),
  max_items: z.number().int().nullable().default(50),
  max_images_per_item: z.number().int().nullable().default(4),
  max_members: z.number().int().nullable().default(1),
});

const featuresSchema = z.object({
  pdf_export: z.boolean().default(true),
  remove_branding: z.boolean().default(false),
  custom_domain: z.boolean().default(false),
  analytics: z.boolean().default(false),
});

export type PlanLimits = z.output<typeof limitsSchema>;
export type PlanFeatures = z.output<typeof featuresSchema>;
export type Entitlements = { planId: string; planName: string; limits: PlanLimits; features: PlanFeatures };

export function parseEntitlements(plan: { id: string; name: string; limits: unknown; features: unknown }): Entitlements {
  const limits = limitsSchema.safeParse(plan.limits ?? {});
  const features = featuresSchema.safeParse(plan.features ?? {});
  return {
    planId: plan.id,
    planName: plan.name,
    limits: limits.success ? limits.data : limitsSchema.parse({}),
    features: features.success ? features.data : featuresSchema.parse({}),
  };
}

export function isWithinLimit(limit: number | null, currentCount: number): boolean {
  return limit === null || currentCount < limit;
}
