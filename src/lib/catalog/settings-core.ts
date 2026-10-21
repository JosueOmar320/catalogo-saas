/**
 * Constantes de la configuración del catálogo SIN zod (las usa el pedido en
 * el navegador). Los esquemas viven en ./settings.ts, que reexporta esto.
 */
export const CURRENCIES = ['USD', 'MXN', 'EUR', 'COP', 'ARS', 'CLP', 'PEN', 'GTQ', 'DOP', 'CRC', 'BOB', 'UYU', 'PYG', 'HNL', 'NIO', 'PAB', 'VES'] as const;

/** Formas de pago que el visitante puede elegir al pedir. */
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'link'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MAX_COUPONS = 20;
export const MAX_ZONES = 20;
export const MAX_PROMOTIONS = 5;
export const MAX_BRANCHES = 10;
