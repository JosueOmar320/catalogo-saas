import { ORDER_STATS_DAYS, utcDay } from '@/lib/orders/stats';

/**
 * Resumen de las visitas del sitio publicado de los últimos N días a partir
 * de los contadores diarios (site_view_stats_daily / item_view_stats_daily).
 * Puro: sin base ni reloj implícito, para probarlo con fechas fijas.
 */
export type ViewDayRow = { day: string; views: number };
export type ViewItemRow = { item_id: string; views: number };

export type ViewStatsSummary = {
  /** Un elemento por día (el más antiguo primero), incluidos los días sin visitas. */
  days: { day: string; count: number }[];
  views: number;
  /** Fichas de producto o servicio vistas en total. */
  itemViews: number;
  /** Lo más visto, hasta `top`. */
  top: { itemId: string; views: number }[];
};

export function summarizeViews(dayRows: ViewDayRow[], itemRows: ViewItemRow[], today: Date, { days = ORDER_STATS_DAYS, top = 5 } = {}): ViewStatsSummary {
  const byDay = new Map(dayRows.map((row) => [row.day, row.views]));
  const series: ViewStatsSummary['days'] = [];
  let views = 0;
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = utcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset)));
    const count = byDay.get(day) ?? 0;
    series.push({ day, count });
    views += count;
  }
  const perItem = new Map<string, number>();
  for (const row of itemRows) perItem.set(row.item_id, (perItem.get(row.item_id) ?? 0) + row.views);
  const ranked = [...perItem]
    .map(([itemId, itemViews]) => ({ itemId, views: itemViews }))
    .sort((a, b) => b.views - a.views || a.itemId.localeCompare(b.itemId));
  return { days: series, views, itemViews: ranked.reduce((sum, item) => sum + item.views, 0), top: ranked.slice(0, top) };
}

/** Pedidos por cada 100 visitas (una cifra decimal), o null si no hay visitas. */
export const ordersPer100Views = (orders: number, views: number) => (views > 0 ? Math.round((orders / views) * 1000) / 10 : null);
