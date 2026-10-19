import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { msg } from '@/i18n/translate';
import { saleEndsSchema } from './sale';

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
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'link'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Monto opcional: '' o null → sin valor; acepta "1,200.50" o "35,5" escritos en el formulario. */
const optionalAmount = () =>
  z
    .preprocess((value) => {
      if (value === '' || value === null || value === undefined) return null;
      if (typeof value !== 'string') return value;
      const text = value.trim().replace(/\s/g, '');
      return Number(/^\d+,\d{1,2}$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, ''));
    }, z.number({ error: msg('Usa un número, ej. 120 o 99.90') }).min(0).max(9_999_999).nullable())
    .default(null);

export const MAX_COUPONS = 20;

/** Cupón de descuento del pedido. El código se guarda en mayúsculas. */
export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, msg('Mínimo 3 caracteres'))
    .max(24)
    .regex(/^[A-Za-z0-9_-]+$/, msg('Sólo letras, números, - y _'))
    .transform((code) => code.toUpperCase()),
  type: z.enum(['percent', 'amount']).default('percent'),
  value: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value),
    z.number({ error: msg('Usa un número, ej. 10') }).positive(msg('Debe ser mayor que 0')).max(9_999_999),
  ),
  /** Subtotal mínimo para usarlo. */
  minSubtotal: optionalAmount(),
  /** Último día de validez y la zona horaria de quien lo programó. */
  ends: saleEndsSchema,
  active: z.boolean().default(true),
});

export type Coupon = z.output<typeof couponSchema>;

export const orderSchema = z.object({
  enabled: z.boolean().default(false),
  /** Primera línea del mensaje. Variables: {negocio}. */
  intro: z.string().trim().max(200).default('Hola {negocio}, quiero hacer este pedido:'),
  /** Pide (opcional) el nombre de quien hace el pedido. */
  askName: z.boolean().default(true),
  /** Cómo se entrega. Sin ninguna, el pedido no pregunta (como antes). */
  pickup: z.boolean().default(false),
  delivery: z.boolean().default(false),
  /** Costo del envío; null = "se confirma por WhatsApp". */
  deliveryFee: optionalAmount(),
  /** Envío gratis desde este subtotal. */
  freeDeliveryFrom: optionalAmount(),
  /** Aclaración del envío: zonas, tiempos ("Sólo zona centro, 30–45 min"). */
  deliveryNote: z.string().trim().max(120).default(''),
  /** Pedido mínimo (sobre el subtotal). */
  minimumOrder: optionalAmount(),
  /** Formas de pago que el cliente puede elegir. */
  payments: z.array(z.enum(PAYMENT_METHODS)).max(PAYMENT_METHODS.length).default([]),
  coupons: z
    .array(couponSchema)
    .max(MAX_COUPONS)
    .refine((list) => new Set(list.map((c) => c.code)).size === list.length, msg('Hay cupones con el mismo código'))
    .refine((list) => list.every((c) => c.type !== 'percent' || c.value <= 100), msg('Un porcentaje no puede pasar de 100'))
    .default([]),
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
