import type { Translator } from '@/i18n/translate';

/**
 * Lista de precios en texto para pegar en WhatsApp (chats, estados, grupos):
 * en el idioma del sitio, por categoría, con negritas de WhatsApp (*así*).
 * Puro: lo arma el panel con los datos del catálogo.
 *
 *   *Café Aurora* — Lista de precios
 *
 *   *Café de especialidad*
 *   • Espresso doble — $45
 *   • Latte de avena — desde $68
 *
 *   Pide aquí: https://…
 */
export type PriceListGroup = { name: string | null; items: { name: string; price: string | null; from?: boolean }[] };

export function priceListText(t: Translator, { businessName, url, groups }: { businessName: string; url: string; groups: PriceListGroup[] }): string {
  const sections = groups
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const lines = group.items.map((item) => `• ${item.name}${item.price ? ` — ${item.from ? t('desde {price}', { price: item.price }) : item.price}` : ''}`);
      return [...(group.name ? [`*${group.name}*`] : []), ...lines].join('\n');
    });
  return [t('*{business}* — Lista de precios', { business: businessName }), ...sections, t('Pide aquí: {url}', { url })].join('\n\n');
}
