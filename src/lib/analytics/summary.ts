import type { TrafficSource } from './source';
import { utcDay } from '@/lib/orders/stats';

/**
 * Analítica de ventas del panel: el periodo elegido contra el anterior, el
 * recorrido (visitas → vieron un producto → agregaron al pedido → enviaron el
 * pedido), los orígenes y los productos. Puro: recibe las filas de los
 * contadores diarios y la fecha de hoy.
 */
export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const parseAnalyticsRange = (value: unknown): AnalyticsRange => ANALYTICS_RANGES.find((days) => String(days) === value) ?? 30;

export type FunnelRow = { day: string; source: string; sessions: number; viewed_product: number; started_cart: number; sent_order: number };
export type OrderDayRow = { day: string; orders: number; units: number; value: number | string };
export type PageViewRow = { day: string; views: number };

export type PeriodTotals = { sessions: number; pageViews: number; viewedProduct: number; startedCart: number; sentOrder: number; orders: number; units: number; value: number };
export type SourceRow = { source: TrafficSource; sessions: number; orders: number; conversion: number | null };
export type FunnelStep = { key: 'sessions' | 'viewedProduct' | 'startedCart' | 'sentOrder'; value: number; ofVisits: number | null; ofPrevious: number | null };

export type AnalyticsSummary = {
  range: AnalyticsRange;
  from: string;
  to: string;
  current: PeriodTotals;
  previous: PeriodTotals;
  /** Pedidos por cada 100 visitas (del recorrido), o null sin visitas. */
  conversion: { current: number | null; previous: number | null };
  /** Valor estimado por pedido, o null sin pedidos. */
  ticket: { current: number | null; previous: number | null };
  funnel: FunnelStep[];
  sources: SourceRow[];
  days: { day: string; sessions: number; orders: number }[];
  /** Primer día con datos del recorrido (antes de él sólo hay páginas vistas y pedidos). */
  funnelSince: string | null;
};

const EMPTY: PeriodTotals = { sessions: 0, pageViews: 0, viewedProduct: 0, startedCart: 0, sentOrder: 0, orders: 0, units: 0, value: 0 };
const dayOffset = (today: Date, offset: number) => utcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset)));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const money = (value: number) => Math.round(value * 100) / 100;

/** Primer día del periodo anterior (para pedir las filas de ambos periodos de una vez). */
export const analyticsWindowStart = (today: Date, range: AnalyticsRange) => dayOffset(today, range * 2 - 1);

/** Variación porcentual contra el periodo anterior (una cifra decimal), o null si antes era 0. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function summarizeAnalytics({ funnel, orders, pageViews }: { funnel: FunnelRow[]; orders: OrderDayRow[]; pageViews: PageViewRow[] }, today: Date, range: AnalyticsRange): AnalyticsSummary {
  const from = dayOffset(today, range - 1);
  const previousFrom = dayOffset(today, range * 2 - 1);
  const to = dayOffset(today, 0);
  const period = (day: string): 'current' | 'previous' | null => (day >= from && day <= to ? 'current' : day >= previousFrom && day < from ? 'previous' : null);
  const totals = { current: { ...EMPTY }, previous: { ...EMPTY } };
  const bySource = new Map<string, { sessions: number; orders: number }>();
  const byDay = new Map<string, { sessions: number; orders: number }>();
  let funnelSince: string | null = null;

  for (const row of funnel) {
    const which = period(row.day);
    if (!which) continue;
    const t = totals[which];
    t.sessions += row.sessions;
    t.viewedProduct += row.viewed_product;
    t.startedCart += row.started_cart;
    t.sentOrder += row.sent_order;
    if (!funnelSince || row.day < funnelSince) funnelSince = row.day;
    if (which === 'current') {
      const source = bySource.get(row.source) ?? { sessions: 0, orders: 0 };
      source.sessions += row.sessions;
      source.orders += row.sent_order;
      bySource.set(row.source, source);
      const day = byDay.get(row.day) ?? { sessions: 0, orders: 0 };
      day.sessions += row.sessions;
      byDay.set(row.day, day);
    }
  }
  for (const row of orders) {
    const which = period(row.day);
    if (!which) continue;
    totals[which].orders += row.orders;
    totals[which].units += row.units;
    totals[which].value += Number(row.value);
    if (which === 'current') {
      const day = byDay.get(row.day) ?? { sessions: 0, orders: 0 };
      day.orders += row.orders;
      byDay.set(row.day, day);
    }
  }
  for (const row of pageViews) {
    const which = period(row.day);
    if (which) totals[which].pageViews += row.views;
  }
  for (const t of [totals.current, totals.previous]) t.value = money(t.value);

  const c = totals.current;
  const steps: [FunnelStep['key'], number][] = [['sessions', c.sessions], ['viewedProduct', c.viewedProduct], ['startedCart', c.startedCart], ['sentOrder', c.sentOrder]];
  const days = Array.from({ length: range }, (_, i) => {
    const day = dayOffset(today, range - 1 - i);
    return { day, ...(byDay.get(day) ?? { sessions: 0, orders: 0 }) };
  });

  return {
    range,
    from,
    to,
    current: totals.current,
    previous: totals.previous,
    conversion: { current: pct(totals.current.sentOrder, totals.current.sessions), previous: pct(totals.previous.sentOrder, totals.previous.sessions) },
    ticket: {
      current: totals.current.orders ? money(totals.current.value / totals.current.orders) : null,
      previous: totals.previous.orders ? money(totals.previous.value / totals.previous.orders) : null,
    },
    funnel: steps.map(([key, value], i) => ({ key, value, ofVisits: pct(value, c.sessions), ofPrevious: i === 0 ? null : pct(value, steps[i - 1][1]) })),
    sources: [...bySource]
      .map(([source, s]) => ({ source: source as TrafficSource, sessions: s.sessions, orders: s.orders, conversion: pct(s.orders, s.sessions) }))
      .filter((s) => s.sessions > 0 || s.orders > 0)
      .sort((a, b) => b.sessions - a.sessions || b.orders - a.orders || a.source.localeCompare(b.source)),
    days,
    funnelSince,
  };
}

export type ProductAnalyticsRow = { itemId: string; name: string; views: number; adds: number; units: number };

/**
 * Productos del periodo: los más vistos, agregados y pedidos. "Se agregan
 * pero casi no se piden": se agregaron 3+ veces y se pidieron menos de la mitad.
 */
export function productAnalytics(items: { id: string; name: string }[], views: Map<string, number>, adds: Map<string, number>, units: Map<string, number>, limit = 10): { top: ProductAnalyticsRow[]; leaks: ProductAnalyticsRow[] } {
  const rows = items
    .map((item) => ({ itemId: item.id, name: item.name, views: views.get(item.id) ?? 0, adds: adds.get(item.id) ?? 0, units: units.get(item.id) ?? 0 }))
    .filter((row) => row.views || row.adds || row.units);
  const top = [...rows].sort((a, b) => b.units - a.units || b.adds - a.adds || b.views - a.views || a.name.localeCompare(b.name)).slice(0, limit);
  const leaks = rows.filter((row) => row.adds >= 3 && row.units < row.adds / 2).sort((a, b) => b.adds - b.units - (a.adds - a.units)).slice(0, 5);
  return { top, leaks };
}
