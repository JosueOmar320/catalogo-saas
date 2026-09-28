import { z } from 'zod';

/**
 * Configuración de comportamiento del catálogo (catalogs.settings).
 * Igual que el tema: todo campo nuevo debe tener default.
 */
export const CURRENCIES = ['USD', 'MXN', 'EUR', 'COP', 'ARS', 'CLP', 'PEN', 'GTQ', 'DOP', 'CRC', 'BOB', 'UYU', 'PYG', 'HNL', 'NIO', 'PAB', 'VES'] as const;

export const contactActionsSchema = z.object({
  whatsapp: z
    .object({
      enabled: z.boolean().default(true),
      label: z.string().trim().min(1).max(40).default('Consultar por WhatsApp'),
      message: z
        .string()
        .trim()
        .max(300)
        .default('Hola, me interesa "{producto}" ({precio}) que vi en su catálogo: {url}'),
    })
    .prefault({}),
  phone: z
    .object({
      enabled: z.boolean().default(false),
      label: z.string().trim().min(1).max(40).default('Llamar'),
    })
    .prefault({}),
  email: z
    .object({
      enabled: z.boolean().default(false),
      label: z.string().trim().min(1).max(40).default('Enviar email'),
      subject: z.string().trim().max(120).default('Consulta sobre {producto}'),
    })
    .prefault({}),
});

export const pdfOptionsSchema = z.object({
  layout: z.enum(['grid', 'list']).default('grid'),
  paperSize: z.enum(['A4', 'LETTER']).default('A4'),
  includeCover: z.boolean().default(true),
  showPrices: z.boolean().default(true),
  showDescriptions: z.boolean().default(true),
  pageBreakPerCategory: z.boolean().default(false),
});

export const catalogSettingsSchema = z.object({
  currency: z.enum(CURRENCIES).default('USD'),
  locale: z.string().max(10).default('es-419'),
  contactActions: contactActionsSchema.prefault({}),
  pdf: pdfOptionsSchema.prefault({}),
});

export type CatalogSettings = z.output<typeof catalogSettingsSchema>;
export type ContactActionsConfig = z.output<typeof contactActionsSchema>;
export type PdfOptions = z.output<typeof pdfOptionsSchema>;

export const seoSchema = z.object({
  title: z.string().trim().max(70).default(''),
  description: z.string().trim().max(160).default(''),
  ogImagePath: z.string().max(300).nullable().default(null),
  noindex: z.boolean().default(false),
});

export type CatalogSeo = z.output<typeof seoSchema>;

function safe<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const result = schema.safeParse(raw ?? {});
  return result.success ? result.data : schema.parse({});
}

export const parseCatalogSettings = (raw: unknown): CatalogSettings => safe(catalogSettingsSchema, raw);
export const parseSeo = (raw: unknown): CatalogSeo => safe(seoSchema, raw);
