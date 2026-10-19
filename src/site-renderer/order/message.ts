import { msg, type Translator } from '@/i18n/translate';
import type { OrderSettings, PaymentMethod, PriceFormat } from '@/lib/catalog/settings';
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

/* ------------------------------------------------------ Entrega, pago y mínimo */

export type Fulfillment = 'pickup' | 'delivery';

/** Lo que el negocio configuró para entregar y cobrar (subconjunto plano de OrderSettings). */
export type OrderOptions = Pick<OrderSettings, 'pickup' | 'delivery' | 'deliveryFee' | 'freeDeliveryFrom' | 'deliveryNote' | 'minimumOrder' | 'payments'>;

/** Lo que elige el cliente en el panel del pedido. */
export type OrderChoices = { fulfillment: Fulfillment | null; address: string; payment: PaymentMethod | null };

export const NO_OPTIONS: OrderOptions = { pickup: false, delivery: false, deliveryFee: null, freeDeliveryFrom: null, deliveryNote: '', minimumOrder: null, payments: [] };
export const NO_CHOICES: OrderChoices = { fulfillment: null, address: '', payment: null };

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: msg('Efectivo'),
  card: msg('Tarjeta'),
  transfer: msg('Transferencia'),
  link: msg('Enlace de pago'),
};

export const fulfillmentOptions = (options: OrderOptions): Fulfillment[] => [...(options.pickup ? ['pickup' as const] : []), ...(options.delivery ? ['delivery' as const] : [])];

/** Con una sola forma de entrega no hay que elegir; con dos, la que eligió el cliente. */
export function effectiveFulfillment(options: OrderOptions, chosen: Fulfillment | null): Fulfillment | null {
  const available = fulfillmentOptions(options);
  if (available.length === 1) return available[0];
  return chosen && available.includes(chosen) ? chosen : null;
}

type Amount = { value: number; partial: boolean };

export type OrderSummary = {
  subtotal: Amount | null;
  /** Envío (sólo a domicilio): monto, gratis o por confirmar. */
  delivery: { kind: 'fee'; value: number } | { kind: 'free' } | { kind: 'confirm' } | null;
  /** Subtotal + envío (si se conoce). */
  total: Amount | null;
  /** Cuánto falta para el pedido mínimo (sólo si todos los precios se conocen). */
  missingForMinimum: number | null;
  /** Cuánto falta para el envío gratis. */
  missingForFreeDelivery: number | null;
  /** Lo que impide enviar: elegir la entrega, escribir la dirección o llegar al mínimo. */
  blocker: 'fulfillment' | 'address' | 'minimum' | null;
};

const cents = (value: number) => Math.round(value * 100) / 100;

export function summarizeOrder(lines: OrderLine[], pricing: OrderPricing, options: OrderOptions = NO_OPTIONS, choices: OrderChoices = NO_CHOICES): OrderSummary {
  const subtotal = orderTotal(lines, pricing);
  const fulfillment = effectiveFulfillment(options, choices.fulfillment);
  const known = subtotal && !subtotal.partial ? subtotal.value : null;

  let delivery: OrderSummary['delivery'] = null;
  let missingForFreeDelivery: number | null = null;
  if (fulfillment === 'delivery') {
    const free = options.freeDeliveryFrom !== null && known !== null && known >= options.freeDeliveryFrom;
    if (free) delivery = { kind: 'free' };
    else if (options.deliveryFee === null) delivery = { kind: 'confirm' };
    else delivery = options.deliveryFee === 0 ? { kind: 'free' } : { kind: 'fee', value: options.deliveryFee };
    if (!free && options.freeDeliveryFrom !== null && known !== null && options.deliveryFee !== 0) missingForFreeDelivery = cents(options.freeDeliveryFrom - known);
  }

  const total = subtotal && { value: cents(subtotal.value + (delivery?.kind === 'fee' ? delivery.value : 0)), partial: subtotal.partial || delivery?.kind === 'confirm' };
  const missingForMinimum = options.minimumOrder !== null && known !== null && known < options.minimumOrder ? cents(options.minimumOrder - known) : null;

  const blocker =
    fulfillmentOptions(options).length > 0 && !fulfillment
      ? 'fulfillment'
      : fulfillment === 'delivery' && !choices.address.trim()
        ? 'address'
        : missingForMinimum !== null
          ? 'minimum'
          : null;
  return { subtotal, delivery, total, missingForMinimum, missingForFreeDelivery, blocker };
}

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
  options?: OrderOptions;
  choices?: OrderChoices;
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
 *   Entrega: A domicilio
 *   Dirección: Av. Juárez 12
 *   Pago: Efectivo
 *   Nombre: Ana
 *   Nota: sin azúcar
 *
 * Con envío a domicilio el total se desglosa en subtotal, envío y total.
 */
export function buildOrderMessage({ lines, pricing, intro, businessName, customerName, note, siteUrl, t, options = NO_OPTIONS, choices = NO_CHOICES }: OrderMessageInput): string {
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

  const { subtotal, delivery } = summarizeOrder(lines, pricing, options, choices);
  const summary: string[] = [];
  const productsTotal = (amount: Amount, key: 'Total' | 'Subtotal') => {
    const value = formatAmount(amount.value, pricing);
    if (key === 'Subtotal') return amount.partial ? t('Subtotal: {amount} (sin los productos por confirmar)', { amount: value }) : t('Subtotal: {amount}', { amount: value });
    return amount.partial ? t('Total: {amount} (sin los productos por confirmar)', { amount: value }) : t('Total: {amount}', { amount: value });
  };
  if (subtotal && delivery) {
    summary.push(productsTotal(subtotal, 'Subtotal'));
    if (delivery.kind === 'fee') {
      summary.push(t('Envío: {amount}', { amount: formatAmount(delivery.value, pricing) }));
      summary.push(productsTotal({ value: cents(subtotal.value + delivery.value), partial: subtotal.partial }, 'Total'));
    } else summary.push(delivery.kind === 'free' ? t('Envío: gratis') : t('Envío: por confirmar'));
  } else if (subtotal) summary.push(productsTotal(subtotal, 'Total'));

  const fulfillment = effectiveFulfillment(options, choices.fulfillment);
  if (fulfillment) summary.push(t('Entrega: {mode}', { mode: fulfillment === 'delivery' ? t('A domicilio') : t('Recoger en el local') }));
  const address = choices.address.trim();
  if (fulfillment === 'delivery' && address) summary.push(t('Dirección: {address}', { address }));
  if (choices.payment && options.payments.includes(choices.payment)) summary.push(t('Pago: {method}', { method: t(PAYMENT_LABELS[choices.payment]) }));
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
