import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { msg } from '@/i18n/translate';
import { saleEndsSchema } from './sale';
import { CURRENCIES, MAX_BRANCHES, MAX_COUPONS, MAX_PROMOTIONS, MAX_ZONES, PAYMENT_METHODS } from './settings-core';

export * from './settings-core';

/**
 * Configuración de comportamiento del catálogo (catalogs.settings).
 * Igual que el tema: todo campo nuevo debe tener default.
 */

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


/** Promoción automática (sin código): desde cierto subtotal, un porcentaje o un monto menos. */
export const promotionSchema = z.object({
  type: z.enum(['percent', 'amount']).default('percent'),
  value: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value),
    z.number({ error: msg('Usa un número, ej. 10') }).positive(msg('Debe ser mayor que 0')).max(9_999_999),
  ),
  /** Subtotal desde el que aplica. */
  minSubtotal: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value.trim().replace(/,/g, '')) : value),
    z.number({ error: msg('Usa un número, ej. 300') }).positive(msg('Debe ser mayor que 0')).max(9_999_999),
  ),
  active: z.boolean().default(true),
});

export type Promotion = z.output<typeof promotionSchema>;

/** Zona de entrega: su costo de envío (vacío = se confirma) y, si tiene, su pedido mínimo. */
export const deliveryZoneSchema = z.object({
  name: z.string().trim().min(1, msg('Escribe el nombre de la zona')).max(60),
  fee: optionalAmount(),
  minimumOrder: optionalAmount(),
});

export type DeliveryZone = z.output<typeof deliveryZoneSchema>;


/** Sucursal: el pedido llega a su WhatsApp; su dirección se muestra al recoger. */
export const branchSchema = z.object({
  name: z.string().trim().min(1, msg('Escribe el nombre de la sucursal')).max(60),
  whatsapp: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, msg('Usa el formato internacional, ej. +52 55 1234 5678')),
  address: z.string().trim().max(200).default(''),
});

export type Branch = z.output<typeof branchSchema>;

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
  /** Pide (opcional) el WhatsApp del cliente: sólo se guarda en la bandeja (lista de clientes y avisos), no va en el mensaje. */
  askPhone: z.boolean().default(true),
  /** Bandeja de pedidos: cada pedido enviado queda también en el panel (para darle seguimiento). */
  inbox: z.boolean().default(true),
  /** Al confirmar un pedido de la bandeja se descuentan las existencias (y se devuelven si se cancela). */
  inboxStock: z.boolean().default(false),
  /** Cómo se entrega. Sin ninguna, el pedido no pregunta (como antes). */
  pickup: z.boolean().default(false),
  delivery: z.boolean().default(false),
  /** Costo del envío; null = "se confirma por WhatsApp". */
  deliveryFee: optionalAmount(),
  /** Envío gratis desde este subtotal. */
  freeDeliveryFrom: optionalAmount(),
  /** Aclaración del envío: zonas, tiempos ("Sólo zona centro, 30–45 min"). */
  deliveryNote: z.string().trim().max(120).default(''),
  /** Zonas de entrega: con alguna, el cliente elige la suya y paga su envío (reemplaza a deliveryFee). */
  zones: z
    .array(deliveryZoneSchema)
    .max(MAX_ZONES)
    .refine((list) => new Set(list.map((z) => z.name.toLowerCase())).size === list.length, msg('Hay zonas con el mismo nombre'))
    .default([]),
  /** Sucursales: con alguna, el cliente elige a cuál pide y el mensaje va a su WhatsApp. */
  branches: z
    .array(branchSchema)
    .max(MAX_BRANCHES)
    .refine((list) => new Set(list.map((b) => b.name.toLowerCase())).size === list.length, msg('Hay sucursales con el mismo nombre'))
    .default([]),
  /** Promociones automáticas: aplica la que más descuenta (y no se suman a un cupón: vale el mayor). */
  promotions: z
    .array(promotionSchema)
    .max(MAX_PROMOTIONS)
    .refine((list) => list.every((p) => p.type !== 'percent' || p.value <= 100), msg('Un porcentaje no puede pasar de 100'))
    .default([]),
  /** Propina opcional (10, 15 o 20 % de los productos): el cliente elige y el mensaje la desglosa. */
  tips: z.boolean().default(false),
  /** Pedidos en mesa: con el código QR de cada mesa (?mesa=5) el pedido va a esa mesa, sin entrega. */
  tables: z.boolean().default(false),
  /** Pedido mínimo (sobre el subtotal). */
  minimumOrder: optionalAmount(),
  /** Formas de pago que el cliente puede elegir. */
  payments: z.array(z.enum(PAYMENT_METHODS)).max(PAYMENT_METHODS.length).default([]),
  /** "¿Para cuándo?": el cliente elige día y hora dentro del horario del negocio. */
  scheduling: z.enum(['off', 'optional', 'required']).default('off'),
  /** Tiempo mínimo de preparación (minutos desde ahora). */
  leadMinutes: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().min(0).max(10_080)).default(60),
  /** Cuántos días hacia adelante se puede elegir. */
  scheduleDays: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().min(1).max(30)).default(7),
  /** Cada cuántos minutos hay un horario para elegir. */
  slotMinutes: z.enum(['15', '30', '60']).default('30'),
  /** Pausa de pedidos (vacaciones, sin servicio): el sitio avisa y no deja enviar. */
  paused: z.boolean().default(false),
  /** Último día de la pausa ("" = hasta reactivarla) y la zona horaria de quien la programó. */
  pausedUntil: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(''),
  pauseTimeZone: z.string().max(64).default(''),
  pauseMessage: z.string().trim().max(160).default(''),
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

/** Reseñas de clientes: el sitio muestra las aprobadas y el formulario para dejar una. */
export const reviewsSchema = z.object({ enabled: z.boolean().default(false) }).prefault({});

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
  /** Reseñas de clientes (las aprueba el negocio antes de publicarse). */
  reviews: reviewsSchema,
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

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Valida campo por campo: lo válido se conserva y sólo lo corrupto vuelve a
 * su valor por defecto (como parseItemAttributes). Un cupón mal guardado no
 * apaga los pedidos ni cambia la moneda del sitio. Un nivel más adentro para
 * los objetos (order, contactActions…), así un campo malo no borra la sección.
 */
function parseByField<T extends z.ZodRawShape>(schema: z.ZodObject<T>, raw: unknown, depth = 1): z.output<z.ZodObject<T>> {
  const whole = schema.safeParse(raw ?? {});
  if (whole.success) return whole.data;
  const partial = isRecord(raw) ? raw : {};
  const entries = Object.entries(schema.shape as unknown as Record<string, z.ZodType>).map(([key, field]) => {
    const result = field.safeParse(partial[key]);
    if (result.success) return [key, result.data];
    const inner = depth > 0 ? unwrapObject(field) : null;
    return [key, inner ? parseByField(inner, partial[key], depth - 1) : field.parse(undefined)];
  });
  return Object.fromEntries(entries) as z.output<z.ZodObject<T>>;
}

/** El objeto detrás de .prefault()/.default() (z.object(...).prefault({}) es un ZodDefault). */
function unwrapObject(field: z.ZodType): z.ZodObject | null {
  let current: unknown = field;
  for (let i = 0; i < 3 && current; i++) {
    if (current instanceof z.ZodObject) return current;
    current = (current as { def?: { innerType?: unknown } }).def?.innerType;
  }
  return null;
}

export const parseCatalogSettings = (raw: unknown): CatalogSettings => parseByField(catalogSettingsSchema, raw);
export const parseSeo = (raw: unknown): CatalogSeo => safe(seoSchema, raw);
