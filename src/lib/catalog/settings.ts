import { z } from 'zod';
import { LOCALES } from '@/i18n/config';

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

/**
 * Pedido por WhatsApp: el visitante arma una lista con cantidades en el sitio
 * y la envía al WhatsApp del negocio con un mensaje ya escrito. Sólo productos.
 */
export const orderSchema = z.object({
  enabled: z.boolean().default(false),
  /** Primera línea del mensaje. Variables: {negocio}. */
  intro: z.string().trim().max(200).default('Hola {negocio}, quiero hacer este pedido:'),
  /** Pide (opcional) el nombre de quien hace el pedido. */
  askName: z.boolean().default(true),
});

export const pdfOptionsSchema = z.object({
  layout: z.enum(['grid', 'list']).default('grid'),
  paperSize: z.enum(['A4', 'LETTER']).default('A4'),
  includeCover: z.boolean().default(true),
  showPrices: z.boolean().default(true),
  showDescriptions: z.boolean().default(true),
  pageBreakPerCategory: z.boolean().default(false),
});

/**
 * Formato de precio (web y PDF): "VALOR: $30", "365 C$", "$1,200.00", "desde 950 MXN".
 */
export const priceFormatSchema = z.object({
  prefix: z.string().trim().max(20).default(''),
  currencyDisplay: z.enum(['symbol', 'code', 'none']).default('symbol'),
  position: z.enum(['before', 'after']).default('before'),
  decimals: z.enum(['auto', '0', '2']).default('auto'),
});

export type PriceFormat = z.output<typeof priceFormatSchema>;

export const catalogSettingsSchema = z.object({
  currency: z.enum(CURRENCIES).default('USD'),
  /** Formato de números y precios (Intl). */
  locale: z.string().max(10).default('es-419'),
  /** Idioma de los textos fijos del sitio público y del PDF ("Buscar", "Agotado"…). */
  language: z.enum(LOCALES).default('es'),
  priceFormat: priceFormatSchema.prefault({}),
  contactActions: contactActionsSchema.prefault({}),
  order: orderSchema.prefault({}),
  pdf: pdfOptionsSchema.prefault({}),
});

export type CatalogSettings = z.output<typeof catalogSettingsSchema>;
export type ContactActionsConfig = z.output<typeof contactActionsSchema>;
export type PdfOptions = z.output<typeof pdfOptionsSchema>;
export type OrderSettings = z.output<typeof orderSchema>;

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
