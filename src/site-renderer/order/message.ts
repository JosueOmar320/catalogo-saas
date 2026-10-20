import { msg, type Translator } from '@/i18n/translate';
import { formatPickup } from '@/lib/business/schedule';
import { isSaleOver, type SaleEnds } from '@/lib/catalog/sale';
import type { Branch, DeliveryZone, OrderSettings, PaymentMethod, PriceFormat } from '@/lib/catalog/settings';
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

export type OrderLine = OrderItem & {
  qty: number;
  /** Indicación del cliente para esta línea ("sin cebolla"). */
  note?: string;
  /** Lleva precio de mayoreo (calculado al mostrar; no se guarda). */
  wholesale?: boolean;
};

/** Precios por mayoreo de cada producto (por id): [desde cuántas piezas, precio c/u], de menor a mayor. */
export type TierIndex = Record<string, [minQty: number, price: number][]>;

/** El escalón de mayoreo que alcanza una cantidad, o null. */
export function tierFor(tiers: TierIndex[string] | undefined, qty: number): [minQty: number, price: number] | null {
  let found: [number, number] | null = null;
  for (const tier of tiers ?? []) if (qty >= tier[0]) found = tier;
  return found;
}

/**
 * Las líneas con el precio de mayoreo que alcanzan. Sólo la línea del
 * producto sin opciones ni extras (su id es el del producto).
 */
export function applyTiers(lines: OrderLine[], tiers: TierIndex): OrderLine[] {
  let changed = false;
  const next = lines.map((line) => {
    const tier = line.price === null ? null : tierFor(tiers[line.id], line.qty);
    if (!tier) return line;
    changed = true;
    return { ...line, price: tier[1], priceLabel: null, wholesale: true };
  });
  return changed ? next : lines;
}

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
export type OrderOptions = Pick<
  OrderSettings,
  'pickup' | 'delivery' | 'deliveryFee' | 'freeDeliveryFrom' | 'deliveryNote' | 'zones' | 'tables' | 'branches' | 'tips' | 'minimumOrder' | 'payments' | 'scheduling' | 'leadMinutes' | 'scheduleDays' | 'slotMinutes'
>;

/* ------------------------------------------------------ Precios al día y pausa */

/** Precio actual de cada línea que se puede pedir ("producto" o "producto:opción"): [precio, etiqueta]. */
export type CatalogIndex = Record<string, [price: number | null, priceLabel: string | null]>;

/**
 * Las líneas guardadas en el navegador con el precio de hoy. Lo que ya no se
 * puede pedir (agotado, oculto, eliminado) sale del pedido y se informa.
 */
export function refreshLines(lines: OrderLine[], catalog: CatalogIndex): { lines: OrderLine[]; removed: string[] } {
  const removed: string[] = [];
  const fresh = lines.flatMap((line) => {
    // "producto:opción+extra1+extra2": la base y cada extra deben seguir disponibles.
    const [base, ...extras] = line.id.split('+');
    const itemId = base.split(':')[0];
    const current = catalog[base];
    const extraPrices = extras.map((extra) => catalog[`${itemId}+${extra}`]);
    if (!current || extraPrices.some((extra) => !extra)) {
      removed.push(line.name);
      return [];
    }
    const sum = extraPrices.reduce((total, extra) => total + (extra![0] ?? 0), 0);
    const price = current[0] === null ? null : Math.round((current[0] + sum) * 100) / 100;
    const priceLabel = extras.length ? null : current[1];
    return [price === line.price && priceLabel === line.priceLabel ? line : { ...line, price, priceLabel }];
  });
  return { lines: removed.length || fresh.some((line, i) => line !== lines[i]) ? fresh : lines, removed };
}

export type OrderPause = { until: string; timeZone: string; message: string };

/** ¿Siguen en pausa los pedidos? Con fecha, se reanudan solos al terminar ese día. */
export const isOrderingPaused = (pause: OrderPause | null, now: Date) => Boolean(pause && !(pause.until && pause.timeZone && isSaleOver({ on: pause.until, timeZone: pause.timeZone }, now)));

/* ------------------------------------------------------------------ Cupones */

/**
 * Cupón tal como llega al navegador: el código no viaja, sólo su huella
 * (`couponHash`), así no se lee en el código de la página. No es una barrera
 * de seguridad (el negocio confirma el pedido por WhatsApp): sólo evita que
 * los códigos queden a la vista.
 */
export type PublicCoupon = { hash: string; type: 'percent' | 'amount'; value: number; minSubtotal: number | null; ends: SaleEnds | null };
/** Cupón aplicado por el cliente: el código que escribió y lo que vale. */
export type AppliedCoupon = PublicCoupon & { code: string };

export const normalizeCouponCode = (code: string) => code.trim().toUpperCase();

/** Huella de 53 bits (cyrb53) del código, con el negocio como sal. Síncrona: igual en servidor y navegador. */
export function couponHash(scope: string, code: string): string {
  const text = `${scope}:${normalizeCouponCode(code)}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Busca el cupón por su código; null si no existe. */
export function findCoupon(coupons: PublicCoupon[], scope: string, code: string): AppliedCoupon | null {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  const hash = couponHash(scope, normalized);
  const coupon = coupons.find((c) => c.hash === hash);
  return coupon ? { ...coupon, code: normalized } : null;
}

/** Lo que elige el cliente en el panel del pedido. */
export type OrderChoices = {
  fulfillment: Fulfillment | null;
  address: string;
  /** Zona de entrega elegida (su nombre), si el negocio usa zonas. */
  zone?: string | null;
  /** Mesa desde la que se pide (código QR de la mesa), si el negocio acepta pedidos en mesa. */
  table?: string | null;
  /** Sucursal elegida (su nombre), si el negocio tiene sucursales. */
  branch?: string | null;
  /** Propina elegida (porcentaje de los productos), si el negocio la pide. */
  tip?: number | null;
  payment: PaymentMethod | null;
  coupon?: AppliedCoupon | null;
  /** Día y hora elegidos ("¿Para cuándo?"), en la zona del negocio; null = lo antes posible. */
  when?: { date: string; time: string } | null;
};

export const NO_OPTIONS: OrderOptions = {
  pickup: false,
  delivery: false,
  deliveryFee: null,
  freeDeliveryFrom: null,
  deliveryNote: '',
  zones: [],
  tables: false,
  branches: [],
  tips: false,
  minimumOrder: null,
  payments: [],
  scheduling: 'off',
  leadMinutes: 60,
  scheduleDays: 7,
  slotMinutes: '30',
};
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
  /** Pedido mínimo que aplica: el del negocio o el de la zona, el mayor. */
  minimum: number | null;
  /** Zona de entrega elegida (si el negocio usa zonas y la entrega es a domicilio). */
  zone: DeliveryZone | null;
  /** Mesa del pedido (en el local): sin entrega, dirección ni "¿Para cuándo?". */
  table: string | null;
  /** Sucursal a la que va el pedido (con una sola, ésa). */
  branch: Branch | null;
  /** Propina (sobre los productos, después del cupón). */
  tip: { percent: number; value: number } | null;
  /** Cuánto falta para el pedido mínimo (sólo si todos los precios se conocen). */
  missingForMinimum: number | null;
  /** Cuánto falta para el envío gratis. */
  missingForFreeDelivery: number | null;
  /** Lo que impide enviar: elegir la sucursal, la entrega o la zona, escribir la dirección, llegar al mínimo o elegir para cuándo. */
  blocker: 'branch' | 'fulfillment' | 'zone' | 'address' | 'minimum' | 'when' | null;
  /** Descuento del cupón (sobre los productos, no el envío). */
  discount: { code: string; value: number } | null;
  /** Por qué el cupón aplicado no descuenta: venció o falta llegar a su mínimo. */
  couponIssue: 'expired' | 'minimum' | null;
};

const cents = (value: number) => Math.round(value * 100) / 100;

/** Propinas que se ofrecen (porcentaje de los productos). */
export const TIP_OPTIONS = [10, 15, 20];

/** La sucursal del pedido: con una sola, ésa; con varias, la elegida (por nombre) o null. */
export function findBranch(options: OrderOptions, name: string | null | undefined): Branch | null {
  if (options.branches.length === 1) return options.branches[0];
  return name ? (options.branches.find((branch) => branch.name === name) ?? null) : null;
}

/** La zona elegida, si existe (por nombre). */
export const findZone = (options: OrderOptions, name: string | null | undefined) => (name ? (options.zones.find((zone) => zone.name === name) ?? null) : null);

/**
 * Totales del pedido. El pedido mínimo y el envío gratis se miden sobre los
 * productos antes del cupón; el cupón descuenta de los productos y el envío se
 * suma aparte. Con zonas de entrega, el envío y el mínimo son los de la zona
 * elegida (el mínimo del negocio sigue valiendo si es mayor).
 */
export function summarizeOrder(lines: OrderLine[], pricing: OrderPricing, options: OrderOptions = NO_OPTIONS, choices: OrderChoices = NO_CHOICES, now: Date = new Date()): OrderSummary {
  const subtotal = orderTotal(lines, pricing);
  const branch = findBranch(options, choices.branch);
  const table = (options.tables && choices.table?.trim()) || null;
  const fulfillment = table ? null : effectiveFulfillment(options, choices.fulfillment);
  const known = subtotal && !subtotal.partial ? subtotal.value : null;

  const zoned = fulfillment === 'delivery' && options.zones.length > 0;
  const zone = zoned ? findZone(options, choices.zone) : null;

  let delivery: OrderSummary['delivery'] = null;
  let missingForFreeDelivery: number | null = null;
  // Con zonas, el envío se conoce al elegir la zona.
  if (fulfillment === 'delivery' && (!zoned || zone)) {
    const fee = zone ? zone.fee : options.deliveryFee;
    const free = options.freeDeliveryFrom !== null && known !== null && known >= options.freeDeliveryFrom;
    if (free) delivery = { kind: 'free' };
    else if (fee === null) delivery = { kind: 'confirm' };
    else delivery = fee === 0 ? { kind: 'free' } : { kind: 'fee', value: fee };
    if (!free && options.freeDeliveryFrom !== null && known !== null && fee !== 0) missingForFreeDelivery = cents(options.freeDeliveryFrom - known);
  }

  const coupon = choices.coupon ?? null;
  let discount: OrderSummary['discount'] = null;
  let couponIssue: OrderSummary['couponIssue'] = null;
  if (coupon && subtotal) {
    if (isSaleOver(coupon.ends, now)) couponIssue = 'expired';
    else if (coupon.minSubtotal !== null && known !== null && known < coupon.minSubtotal) couponIssue = 'minimum';
    else {
      const value = coupon.type === 'percent' ? cents((subtotal.value * Math.min(coupon.value, 100)) / 100) : Math.min(coupon.value, subtotal.value);
      if (value > 0) discount = { code: coupon.code, value: cents(value) };
    }
  }

  const tipPercent = options.tips && choices.tip && TIP_OPTIONS.includes(choices.tip) ? choices.tip : 0;
  const tip = subtotal && tipPercent ? { percent: tipPercent, value: cents(((subtotal.value - (discount?.value ?? 0)) * tipPercent) / 100) } : null;

  const total = subtotal && {
    value: cents(subtotal.value - (discount?.value ?? 0) + (delivery?.kind === 'fee' ? delivery.value : 0) + (tip?.value ?? 0)),
    partial: subtotal.partial || delivery?.kind === 'confirm',
  };
  // En la mesa no hay pedido mínimo (es para la entrega o para recoger).
  const minimums = table ? [] : [options.minimumOrder, zone?.minimumOrder ?? null].filter((value): value is number => value !== null);
  const minimum = minimums.length ? Math.max(...minimums) : null;
  const missingForMinimum = minimum !== null && known !== null && known < minimum ? cents(minimum - known) : null;

  const blocker =
    options.branches.length > 0 && !branch
      ? 'branch'
      : !table && fulfillmentOptions(options).length > 0 && !fulfillment
      ? 'fulfillment'
      : zoned && !zone
        ? 'zone'
      : fulfillment === 'delivery' && !choices.address.trim()
        ? 'address'
        : missingForMinimum !== null
          ? 'minimum'
          : !table && options.scheduling === 'required' && !choices.when
            ? 'when'
            : null;
  return { subtotal, delivery, total, minimum, zone, table, branch, tip, missingForMinimum, missingForFreeDelivery, blocker, discount, couponIssue };
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
  now?: Date;
  /** Folio del pedido ("K7Q2"), para que el negocio y el cliente lo identifiquen. */
  reference?: string;
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
 * Con envío a domicilio o cupón, el total se desglosa (subtotal, cupón, envío y total).
 */
export function buildOrderMessage({ lines, pricing, intro, businessName, customerName, note, siteUrl, t, options = NO_OPTIONS, choices = NO_CHOICES, now, reference }: OrderMessageInput): string {
  const head = intro.replace(/\{negocio\}/g, businessName).trim();
  const items = lines.map((line) => {
    const sku = line.sku ? ` (${line.sku})` : '';
    const price =
      line.price !== null && line.currency === pricing.currency
        ? ` — ${formatAmount(line.price * line.qty, pricing)}${line.wholesale ? ` ${t('(mayoreo, {price} c/u)', { price: formatAmount(line.price, pricing) })}` : ''}`
        : line.priceLabel
          ? ` — ${line.priceLabel}`
          : ` ${t('(precio por confirmar)')}`;
    const note = line.note?.trim();
    return `• ${line.qty} × ${line.name}${sku}${price}${note ? `\n   ${t('Nota: {note}', { note })}` : ''}`;
  });

  const { subtotal, delivery, discount, total, zone, table, branch, tip } = summarizeOrder(lines, pricing, options, choices, now);
  const summary: string[] = [];
  const productsTotal = (amount: Amount, key: 'Total' | 'Subtotal') => {
    const value = formatAmount(amount.value, pricing);
    if (key === 'Subtotal') return amount.partial ? t('Subtotal: {amount} (sin los productos por confirmar)', { amount: value }) : t('Subtotal: {amount}', { amount: value });
    return amount.partial ? t('Total: {amount} (sin los productos por confirmar)', { amount: value }) : t('Total: {amount}', { amount: value });
  };
  if (subtotal && total && (delivery || discount || tip)) {
    summary.push(productsTotal(subtotal, 'Subtotal'));
    if (discount) summary.push(t('Cupón {code}: −{amount}', { code: discount.code, amount: formatAmount(discount.value, pricing) }));
    if (delivery?.kind === 'fee') summary.push(t('Envío: {amount}', { amount: formatAmount(delivery.value, pricing) }));
    else if (delivery) summary.push(delivery.kind === 'free' ? t('Envío: gratis') : t('Envío: por confirmar'));
    if (tip) summary.push(t('Propina ({percent} %): {amount}', { percent: tip.percent, amount: formatAmount(tip.value, pricing) }));
    if (discount || delivery?.kind === 'fee' || tip) summary.push(productsTotal({ value: total.value, partial: subtotal.partial }, 'Total'));
  } else if (subtotal) summary.push(productsTotal(subtotal, 'Total'));

  const fulfillment = table ? null : effectiveFulfillment(options, choices.fulfillment);
  if (branch && options.branches.length > 1) summary.push(t('Sucursal: {branch}', { branch: branch.name }));
  if (table) summary.push(t('Mesa: {table}', { table }));
  if (!table && options.scheduling !== 'off' && choices.when) summary.push(t('Para: {when}', { when: formatPickup(choices.when.date, choices.when.time, pricing.locale) }));
  if (fulfillment) summary.push(t('Entrega: {mode}', { mode: fulfillment === 'delivery' ? t('A domicilio') : t('Recoger en el local') }));
  if (zone) summary.push(t('Zona: {zone}', { zone: zone.name }));
  const address = choices.address.trim();
  if (fulfillment === 'delivery' && address) summary.push(t('Dirección: {address}', { address }));
  if (choices.payment && options.payments.includes(choices.payment)) summary.push(t('Pago: {method}', { method: t(PAYMENT_LABELS[choices.payment]) }));
  const name = customerName?.trim();
  if (name) summary.push(t('Nombre: {name}', { name }));
  const extra = note?.trim();
  if (extra) summary.push(t('Nota: {note}', { note: extra }));
  if (reference) summary.push(t('Folio: {reference}', { reference }));

  return [head, '', ...items, '', ...summary, ...(summary.length ? [''] : []), t('Pedido desde {url}', { url: siteUrl })].join('\n').trim();
}

/** Enlace wa.me con el mensaje, o null si el número no sirve. */
export function orderWhatsappHref(whatsapp: string, text: string): string | null {
  const number = digitsOnly(whatsapp).replace('+', '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}
