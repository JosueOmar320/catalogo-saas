import type { Schedule } from '@/lib/business/schedule';
import type { CatalogItemView, CatalogVariantsView } from '@/lib/catalog/view-model';
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
      minimumOrder: order.minimumOrder,
      payments: order.payments,
    },
    coupons: order.coupons
      .filter((coupon) => coupon.active)
      .map((coupon) => ({ hash: couponHash(site.business.slug, coupon.code), type: coupon.type, value: coupon.value, minSubtotal: coupon.minSubtotal, ends: coupon.ends })),
    couponScope: site.business.slug,
    catalog: catalogIndex(site),
    suggestions: suggestions(site),
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

/** Línea del pedido para una opción: su propio id, nombre "Producto (Opción)" y precio. */
export function variantOrderItem(
  item: Pick<CatalogItemView, 'id' | 'name' | 'sku' | 'currency' | 'url' | 'images'>,
  option: CatalogVariantsView['options'][number],
): OrderItem {
  return {
    id: `${item.id}:${option.id}`,
    itemId: item.id,
    name: `${item.name} (${option.name})`,
    sku: option.sku ?? item.sku,
    price: option.price,
    priceLabel: option.priceLabel,
    currency: item.currency,
    url: item.url,
    image: item.images[0]?.thumbUrl ?? null,
  };
}

const MAX_SUGGESTIONS = 6;

function catalogIndex(site: SiteViewModel): CatalogIndex {
  const index: CatalogIndex = {};
  for (const item of site.items) {
    if (!orderable(site, item)) continue;
    if (item.variants) {
      for (const option of item.variants.options) if (option.available) index[`${item.id}:${option.id}`] = [option.price, option.priceLabel];
    } else index[item.id] = [item.price, item.priceLabel];
  }
  return index;
}

/** Destacados primero y después el resto, en el orden del catálogo; sólo con precio y sin opciones que elegir. */
function suggestions(site: SiteViewModel): OrderItem[] {
  const candidates = site.items.filter((item) => orderable(site, item) && !item.variants && item.price !== null);
  return [...candidates.filter((i) => i.isFeatured), ...candidates.filter((i) => !i.isFeatured)].slice(0, MAX_SUGGESTIONS).map(toOrderItem);
}
