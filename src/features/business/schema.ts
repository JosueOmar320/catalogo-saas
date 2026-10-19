import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { BUSINESS_SLUG_PATTERN } from '@/lib/utils/slug';

export const businessSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/^-+|-+$/g, ''))
  .pipe(z.string().regex(BUSINESS_SLUG_PATTERN, msg('Usa de 3 a 48 letras minúsculas, números o guiones')));

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, msg('Escribe el nombre de tu negocio')).max(120),
  slug: businessSlugSchema,
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), msg('Usa el formato internacional, ej. +52 55 1234 5678')),
  presetId: z.string().max(40),
  offering: z.enum(['products', 'services', 'both']),
});

export type OnboardingValues = z.input<typeof onboardingSchema>;

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, msg('Escribe el nombre de tu negocio')).max(120),
  slug: businessSlugSchema,
  slogan: z.string().trim().max(160),
  description: z.string().trim().max(500),
});

export type BusinessProfileValues = z.input<typeof businessProfileSchema>;
