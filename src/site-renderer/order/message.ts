import type { Translator } from '@/i18n/translate';
import type { PriceFormat } from '@/lib/catalog/settings';
import { formatPrice } from '@/lib/utils/format';
import { digitsOnly } from '@/lib/utils/phone';

/**
 * Pedido por WhatsApp: lógica pura (sin React ni navegador) para armar el
 * total y el mensaje. Los textos van en el idioma del sitio (`t` = siteTranslator).
 */

export const MAX_ORDER_LINES = 50;
export const MAX_ORDER_QTY = 99;

/** Lo que se guarda de cada producto al agregarlo (foto del momento: no hay que volver a pedir el catálogo). */
export type OrderItem = {
  /** Línea del pedido: el producto, o "producto:opción" si tiene opciones. */
  id: string;
  /** Producto al que pertenece la línea (para las estadísticas). Sin opciones, igual a `id`. */
  itemId?: string | null;
  name: string;
  sku: string | null;
  price: number | null;
  priceLabel: string | null;
  currency: string;
  url: string;
  image: string | null;
};

export type OrderLine = OrderItem & { qty: number };

/** Formato de precios del sitio (moneda, locale y formato del catálogo). */
export type OrderPricing = { currency: string; locale: string; format: PriceFormat };

export const clampQty = (qty: number) => Math.min(MAX_ORDER_QTY, Math.max(0, Math.round(Number.isFinite(qty) ? qty : 0)));

/**
 * Total del pedido. `partial` indica que hay productos sin precio (o en otra
 * moneda) que no se sumaron: el negocio confirma el monto final.
 */
export function orderTotal(lines: OrderLine[], pricing: OrderPricing): { value: number; partial: boolean } | null {
  let value = 0;
  let partial = false;
  let priced = 0;
  for (const line of lines) {
    if (line.price === null || line.currency !== pricing.currency) {
      partial = true;
      continue;
    }
    value += line.price * line.qty;
    priced++;
  }
  // Redondeo a centavos para evitar 0.30000000000000004.
  return priced ? { value: Math.round(value * 100) / 100, partial } : null;
}

export const formatAmount = (value: number, pricing: OrderPricing) => formatPrice(value, pricing.currency, pricing.locale, pricing.format);

export type OrderMessageInput = {
  lines: OrderLine[];
  pricing: OrderPricing;
  /** Primera línea (ya traducida si es la de fábrica). Variables: {negocio}. */
  intro: string;
  businessName: string;
  customerName?: string;
  note?: string;
  /** URL del sitio, para que el negocio sepa de dónde vino el pedido. */
  siteUrl: string;
  t: Translator;
};

/**
 * Mensaje listo para WhatsApp:
 *
 *   Hola Café Aurora, quiero hacer este pedido:
 *
 *   • 2 × Croissant — $96
 *   • 1 × Pastel (por confirmar)
 *
 *   Total: $96 (sin los productos por confirmar)
 *   Nombre: Ana
 *   Nota: sin azúcar
 */
export function buildOrderMessage({ lines, pricing, intro, businessName, customerName, note, siteUrl, t }: OrderMessageInput): string {
  const head = intro.replace(/\{negocio\}/g, businessName).trim();
  const items = lines.map((line) => {
    const sku = line.sku ? ` (${line.sku})` : '';
    const price =
      line.price !== null && line.currency === pricing.currency
        ? ` — ${formatAmount(line.price * line.qty, pricing)}`
        : line.priceLabel
          ? ` — ${line.priceLabel}`
          : ` ${t('(precio por confirmar)')}`;
    return `• ${line.qty} × ${line.name}${sku}${price}`;
  });

  const total = orderTotal(lines, pricing);
  const summary: string[] = [];
  if (total) {
    const amount = formatAmount(total.value, pricing);
    summary.push(total.partial ? t('Total: {amount} (sin los productos por confirmar)', { amount }) : t('Total: {amount}', { amount }));
  }
  const name = customerName?.trim();
  if (name) summary.push(t('Nombre: {name}', { name }));
  const extra = note?.trim();
  if (extra) summary.push(t('Nota: {note}', { note: extra }));

  return [head, '', ...items, '', ...summary, ...(summary.length ? [''] : []), t('Pedido desde {url}', { url: siteUrl })].join('\n').trim();
}

/** Enlace wa.me con el mensaje, o null si el número no sirve. */
export function orderWhatsappHref(whatsapp: string, text: string): string | null {
  const number = digitsOnly(whatsapp).replace('+', '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}
