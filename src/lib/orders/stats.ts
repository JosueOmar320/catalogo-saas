/**
 * Resumen de los pedidos por WhatsApp de los últimos N días a partir de los
 * contadores diarios (order_stats_daily / order_item_stats_daily). Puro: sin
 * base ni reloj implícito, para probarlo con fechas fijas.
 */

export const ORDER_STATS_DAYS = 30;

export type OrderDayRow = { day: string; orders: number; units: number; value: number | string };
export type OrderItemRow = { item_id: string; units: number };

export type OrderStatsSummary = {
  /** Un elemento por día (el más antiguo primero), incluidos los días sin pedidos. */
  days: { day: string; orders: number }[];
  orders: number;
  units: number;
  value: number;
  /** Productos más pedidos (por unidades), hasta `top`. */
  top: { itemId: string; units: number }[];
};

/** Fecha UTC "YYYY-MM-DD" (los contadores se guardan por día UTC). */
export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

/** Primer día de la ventana (incluido). */
export function windowStart(today: Date, days = ORDER_STATS_DAYS): string {
  return utcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1))));
}

export function summarizeOrders(dayRows: OrderDayRow[], itemRows: OrderItemRow[], today: Date, { days = ORDER_STATS_DAYS, top = 3 } = {}): OrderStatsSummary {
  const byDay = new Map(dayRows.map((row) => [row.day, row]));
  const series: OrderStatsSummary['days'] = [];
  let orders = 0;
  let units = 0;
  let value = 0;
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = utcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset)));
    const row = byDay.get(day);
    series.push({ day, orders: row?.orders ?? 0 });
    if (row) {
      orders += row.orders;
      units += row.units;
      value += Number(row.value) || 0;
    }
  }

  const perItem = new Map<string, number>();
  for (const row of itemRows) perItem.set(row.item_id, (perItem.get(row.item_id) ?? 0) + row.units);
  const ranked = [...perItem]
    .map(([itemId, itemUnits]) => ({ itemId, units: itemUnits }))
    .sort((a, b) => b.units - a.units || a.itemId.localeCompare(b.itemId))
    .slice(0, top);

  return { days: series, orders, units, value: Math.round(value * 100) / 100, top: ranked };
}
