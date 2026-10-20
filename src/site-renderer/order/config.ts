import type { Schedule } from '@/lib/business/schedule';
import type { CatalogExtrasView, CatalogItemView, CatalogVariantsView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import { digitsOnly } from '@/lib/utils/phone';
import { defaultText } from '../default-texts';
import { siteTranslator } from '../site-i18n';
import { couponHash, type CatalogIndex, type OrderItem, type OrderOptions, type OrderPause, type OrderPricing, type PublicCoupon } from './message';

/** Lo que necesita el pedido en el navegador (datos planos: viaja del servidor al cliente). */
export type OrderConfig = {
  /** Clave de localStorage: un pedido por negocio. */
  storageKey: string;
  whatsapp: string;
  businessName: string;
  intro: string;
  askName: boolean;
  siteUrl: string;
  pricing: OrderPricing;
  /** Entrega, envío, pedido mínimo y formas de pago. */
  options: OrderOptions;
  /** Cupones activos, sin el código (sólo su huella). */
  coupons: PublicCoupon[];
  /** Sal de la huella de los cupones (el negocio). */
  couponScope: string;
  /** Precio actual de todo lo que se puede pedir: el pedido guardado se actualiza con él. */
  catalog: CatalogIndex;
  /** Sugerencias para "¿Agregas algo más?" (destacados primero; sin opciones que elegir). */
  suggestions: OrderItem[];
  /** Pedidos en pausa (vacaciones…), o null. */
  pause: OrderPause | null;
  /** Productos que sólo se piden en un horario del día (por id de producto). */
  orderHours: Record<string, { from: string; to: string }>;
  /** Existencias de los productos que las controlan (por id de producto). */
  stock: Record<string, number>;
  /** Zona horaria del negocio (la de su horario por día; vacía = la del visitante). */
  timeZone: string;
  /** Horario por día (si el negocio lo usa): el panel avisa cuando está cerrado. */
  schedule: Schedule | null;
  /** Negocio al que se le cuenta el pedido enviado (sólo en el sitio publicado). */
  trackSlug: string | null;
};

/**
 * Configuración del pedido, o null si está apagado o el negocio no tiene WhatsApp.
 * `track`: contar los pedidos enviados (sólo el sitio publicado; la demo y las
 * vistas previas del panel no cuentan).
 */
export function orderConfig(site: SiteViewModel, { track = false }: { track?: boolean } = {}): OrderConfig | null {
  const { order, currency, locale, priceFormat, language } = site.settings;
  const whatsapp = digitsOnly(site.business.contact.whatsapp);
  if (!order.enabled || !whatsapp) return null;
  return {
    storageKey: `order:${site.business.slug}`,
    whatsapp,
    businessName: site.business.name,
    intro: defaultText(order.intro, siteTranslator(language)),
    askName: order.askName,
    siteUrl: site.url,
    pricing: { currency, locale, format: priceFormat },
    options: {
      pickup: order.pickup,
      delivery: order.delivery,
      deliveryFee: order.deliveryFee,
      freeDeliveryFrom: order.freeDeliveryFrom,
      deliveryNote: order.deliveryNote,
      zones: order.zones,
      minimumOrder: order.minimumOrder,
      payments: order.payments,
      scheduling: order.scheduling,
      leadMinutes: order.leadMinutes,
      scheduleDays: order.scheduleDays,
      slotMinutes: order.slotMinutes,
    },
    coupons: order.coupons
      .filter((coupon) => coupon.active)
      .map((coupon) => ({ hash: couponHash(site.business.slug, coupon.code), type: coupon.type, value: coupon.value, minSubtotal: coupon.minSubtotal, ends: coupon.ends })),
    couponScope: site.business.slug,
    catalog: catalogIndex(site),
    suggestions: suggestions(site),
    orderHours: Object.fromEntries(site.items.flatMap((item) => (item.orderHours && orderable(site, item) ? [[item.id, item.orderHours]] : []))),
    timeZone: site.business.contact.schedule.timezone,
    stock: Object.fromEntries(site.items.flatMap((item) => (item.stock !== null && orderable(site, item) ? [[item.id, item.stock]] : []))),
    pause: order.paused ? { until: order.pausedUntil, timeZone: order.pauseTimeZone, message: order.pauseMessage } : null,
    schedule: site.business.contact.schedule.enabled ? site.business.contact.schedule : null,
    trackSlug: track ? site.business.slug : null,
  };
}

/** Sólo los productos disponibles se piden; los servicios se siguen consultando. */
export const orderable = (site: SiteViewModel, item: CatalogItemView) =>
  site.settings.order.enabled && item.type === 'product' && item.isAvailable && Boolean(digitsOnly(site.business.contact.whatsapp));

export function toOrderItem(item: CatalogItemView): OrderItem {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    price: item.price,
    priceLabel: item.priceLabel,
    currency: item.currency,
    url: item.url,
    image: item.images[0]?.thumbUrl ?? null,
  };
}

type LineSource = Pick<CatalogItemView, 'id' | 'name' | 'sku' | 'currency' | 'url' | 'images' | 'price' | 'priceLabel'>;
type ExtraOption = CatalogExtrasView['options'][number];

/**
 * Línea del pedido para lo que eligió el cliente: la opción (si tiene) y los
 * extras. Id "producto:opción+extra1+extra2" (ids ordenados: la misma
 * elección es la misma línea), nombre "Latte (16 oz) + Shot extra, Canela"
 * (extras en el orden en que llegan: el de la ficha) y precio = opción (o
 * producto) + extras.
 */
export function optionOrderItem(item: LineSource, option: CatalogVariantsView['options'][number] | null, extras: ExtraOption[] = []): OrderItem {
  const chosen = extras;
  const base = option ? option.price : item.price;
  const ids = chosen.map((extra) => extra.id).sort();
  return {
    id: `${item.id}${option ? `:${option.id}` : ''}${ids.map((id) => `+${id}`).join('')}`,
    itemId: item.id,
    name: `${item.name}${option ? ` (${option.name})` : ''}${chosen.length ? ` + ${chosen.map((extra) => extra.name).join(', ')}` : ''}`,
    sku: option?.sku ?? item.sku,
    price: base === null ? null : Math.round((base + chosen.reduce((sum, extra) => sum + extra.price, 0)) * 100) / 100,
    priceLabel: chosen.length ? null : option ? option.priceLabel : item.priceLabel,
    currency: item.currency,
    url: item.url,
    image: item.images[0]?.thumbUrl ?? null,
  };
}

/** Línea del pedido para una opción: su propio id, nombre "Producto (Opción)" y precio. */
export const variantOrderItem = (item: LineSource, option: CatalogVariantsView['options'][number]) => optionOrderItem(item, option);

const MAX_SUGGESTIONS = 6;

function catalogIndex(site: SiteViewModel): CatalogIndex {
  const index: CatalogIndex = {};
  for (const item of site.items) {
    if (!orderable(site, item)) continue;
    if (item.variants) {
      for (const option of item.variants.options) if (option.available) index[`${item.id}:${option.id}`] = [option.price, option.priceLabel];
    } else index[item.id] = [item.price, item.priceLabel];
    // Cada extra disponible: "producto+extra" → su precio (se suma al de la línea).
    for (const extra of item.extras?.options ?? []) if (extra.available) index[`${item.id}+${extra.id}`] = [extra.price, null];
  }
  return index;
}

/** Destacados primero y después el resto, en el orden del catálogo; sólo con precio y sin opciones que elegir. */
function suggestions(site: SiteViewModel): OrderItem[] {
  const candidates = site.items.filter((item) => orderable(site, item) && !item.variants && !item.orderHours && item.price !== null);
  return [...candidates.filter((i) => i.isFeatured), ...candidates.filter((i) => !i.isFeatured)].slice(0, MAX_SUGGESTIONS).map(toOrderItem);
}
