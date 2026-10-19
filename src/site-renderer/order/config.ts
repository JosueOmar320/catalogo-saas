import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import { digitsOnly } from '@/lib/utils/phone';
import { defaultText } from '../default-texts';
import { siteTranslator } from '../site-i18n';
import type { OrderItem, OrderPricing } from './message';

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
};

/** Configuración del pedido, o null si está apagado o el negocio no tiene WhatsApp. */
export function orderConfig(site: SiteViewModel): OrderConfig | null {
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
