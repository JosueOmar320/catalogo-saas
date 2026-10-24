import { toCsv } from '@/lib/catalog/csv';
import { msg, type Translator } from '@/i18n/translate';
import type { OrderStatus } from '@/types/database';

/**
 * Clientes: los arma la vista customer_summaries con los pedidos de la
 * bandeja (por teléfono, o por nombre si no lo dio). Aquí lo puro: el número
 * para wa.me, el mensaje para avisarle y el CSV.
 */
export type Customer = {
  key: string;
  name: string | null;
  phone: string | null;
  orders: number;
  delivered: number;
  spent: number;
  currency: string;
  firstOrderAt: string;
  lastOrderAt: string;
};

/** Orden de la lista (?orden=…). */
export const CUSTOMER_SORTS = [
  { slug: 'recientes', label: msg('Pedido más reciente'), column: 'last_order_at' },
  { slug: 'pedidos', label: msg('Más pedidos'), column: 'orders' },
  { slug: 'gasto', label: msg('Mayor gasto'), column: 'spent' },
] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];
export const findSort = (slug: unknown): CustomerSort => CUSTOMER_SORTS.find((sort) => sort.slug === slug) ?? CUSTOMER_SORTS[0];

/** A partir de cuántos pedidos (no cancelados) es "cliente frecuente". */
export const FREQUENT_FROM = 2;

/**
 * Número para wa.me (sólo dígitos, con lada internacional). Si el cliente lo
 * escribió sin lada (10 dígitos), se usa la del WhatsApp del negocio.
 */
export function whatsappNumber(phone: string | null | undefined, businessWhatsapp = ''): string | null {
  const raw = phone?.trim() ?? '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (raw.startsWith('+') || digits.length > 10) return digits;
  const business = businessWhatsapp.replace(/\D/g, '');
  return business.length > 10 ? `${business.slice(0, business.length - 10)}${digits}` : digits;
}

/** Enlace para escribirle al cliente por WhatsApp (con un mensaje), o null sin número. */
export function customerWhatsappLink(phone: string | null | undefined, businessWhatsapp: string, text = ''): string | null {
  const number = whatsappNumber(phone, businessWhatsapp);
  return number ? `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;
}

/** Mensaje para avisarle al cliente cómo va su pedido (según el estado). */
export function orderUpdateMessage(t: Translator, status: OrderStatus, { name, reference, business }: { name: string | null; reference: string; business: string }): string {
  const hello = name?.trim() ? t('¡Hola, {name}!', { name: name.trim().split(/\s+/)[0] }) : t('¡Hola!');
  const body = {
    new: t('Recibimos tu pedido #{reference} en {business}. En un momento te lo confirmamos.', { reference, business }),
    confirmed: t('Confirmamos tu pedido #{reference} en {business}. Te avisamos cuando esté listo.', { reference, business }),
    ready: t('Tu pedido #{reference} de {business} está listo.', { reference, business }),
    delivered: t('Gracias por tu pedido #{reference} en {business}. ¡Esperamos verte pronto!', { reference, business }),
    cancelled: t('Tu pedido #{reference} en {business} se canceló. Escríbenos si tienes dudas.', { reference, business }),
  }[status];
  return `${hello} ${body}`;
}

/** Un cliente por fila, para Excel. */
export function customersCsv(t: Translator, customers: Customer[], timeZone = 'UTC'): string {
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return toCsv([
    [t('Cliente'), t('WhatsApp'), t('Pedidos'), t('Entregados'), t('Total'), t('Moneda'), t('Primer pedido'), t('Último pedido')],
    ...customers.map((c) => [c.name ?? '', c.phone ?? '', String(c.orders), String(c.delivered), Number(c.spent).toFixed(2), c.currency, day.format(new Date(c.firstOrderAt)), day.format(new Date(c.lastOrderAt))]),
  ]);
}
