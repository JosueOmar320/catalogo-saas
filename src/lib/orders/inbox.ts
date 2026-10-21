import { toCsv } from '@/lib/catalog/csv';
import { msg, type Translator } from '@/i18n/translate';
import { PAYMENT_LABELS } from '@/site-renderer/order/message';
import type { OrderLineRow, OrderStatus } from '@/types/database';

/** Bandeja de pedidos: estados, pestañas y el reporte CSV (puro: lo usan la página, la ruta y las pruebas). */
export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'ready', 'delivered', 'cancelled'];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: msg('Nuevo'),
  confirmed: msg('Confirmado'),
  ready: msg('Listo'),
  delivered: msg('Entregado'),
  cancelled: msg('Cancelado'),
};

/** El siguiente paso natural de cada estado (el botón principal). */
export const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'confirmed', label: msg('Confirmar') },
  confirmed: { status: 'ready', label: msg('Marcar listo') },
  ready: { status: 'delivered', label: msg('Marcar entregado') },
};

/** Pestañas de /dashboard/pedidos (?estado=…). */
export const ORDER_TABS = [
  { slug: 'nuevos', label: msg('Nuevos'), statuses: ['new'] },
  { slug: 'en-curso', label: msg('En curso'), statuses: ['confirmed', 'ready'] },
  { slug: 'entregados', label: msg('Entregados'), statuses: ['delivered'] },
  { slug: 'cancelados', label: msg('Cancelados'), statuses: ['cancelled'] },
  { slug: 'todos', label: msg('Todos'), statuses: ORDER_STATUSES },
] as const satisfies readonly { slug: string; label: string; statuses: readonly OrderStatus[] }[];
export type OrderTab = (typeof ORDER_TABS)[number];

/** Periodos (?dias=…). */
export const ORDER_RANGES = [1, 7, 30, 90] as const;
export const DEFAULT_RANGE = 30;
export const parseRange = (value: unknown): number => ORDER_RANGES.find((days) => String(days) === value) ?? DEFAULT_RANGE;
export const findTab = (slug: unknown): OrderTab => ORDER_TABS.find((tab) => tab.slug === slug) ?? ORDER_TABS[0];

export const FULFILLMENT_LABELS = { pickup: msg('Recoger en el local'), delivery: msg('A domicilio'), table: msg('En mesa') } as const;

/** Forma de pago guardada ("cash") → su nombre ("Efectivo"). */
export const paymentLabel = (t: Translator, payment: string) => (payment in PAYMENT_LABELS ? t(PAYMENT_LABELS[payment as keyof typeof PAYMENT_LABELS]) : payment);

/** "2 × Croissant; 1 × Café (Grande)" */
export const linesText = (lines: OrderLineRow[]) => lines.map((line) => `${line.qty} × ${line.name}`).join('; ');

type CsvOrder = {
  reference: string;
  created_at: string;
  status: OrderStatus;
  customer_name: string | null;
  fulfillment: keyof typeof FULFILLMENT_LABELS | null;
  address: string | null;
  zone: string | null;
  branch: string | null;
  table_label: string | null;
  scheduled_for: string | null;
  payment: string | null;
  coupon: string | null;
  note: string | null;
  lines: OrderLineRow[];
  subtotal: number | null;
  discount: number | null;
  delivery_fee: number | null;
  tip: number | null;
  total: number | null;
  currency: string;
};

const amount = (value: number | null) => (value === null ? '' : Number(value).toFixed(2));

/** Un pedido por fila (los más recientes primero), para Excel. */
export function ordersCsv(t: Translator, orders: CsvOrder[], timeZone = 'UTC'): string {
  const when = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  return toCsv([
    [t('Folio'), t('Fecha'), t('Estado'), t('Cliente'), t('Entrega'), t('Dirección'), t('Zona'), t('Sucursal'), t('Mesa'), t('Para'), t('Pago'), t('Cupón'), t('Productos'), t('Subtotal'), t('Descuento'), t('Envío'), t('Propina'), t('Total'), t('Moneda'), t('Nota')],
    ...orders.map((order) => [
      order.reference,
      when.format(new Date(order.created_at)),
      t(ORDER_STATUS_LABELS[order.status]),
      order.customer_name ?? '',
      order.fulfillment ? t(FULFILLMENT_LABELS[order.fulfillment]) : '',
      order.address ?? '',
      order.zone ?? '',
      order.branch ?? '',
      order.table_label ?? '',
      order.scheduled_for ?? '',
      order.payment ? paymentLabel(t, order.payment) : '',
      order.coupon ?? '',
      linesText(order.lines),
      amount(order.subtotal),
      amount(order.discount),
      amount(order.delivery_fee),
      amount(order.tip),
      amount(order.total),
      order.currency,
      order.note ?? '',
    ]),
  ]);
}
