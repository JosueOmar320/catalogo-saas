import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { analyticsWindowStart, productAnalytics, summarizeAnalytics, type AnalyticsRange, type AnalyticsSummary, type FunnelRow, type OrderDayRow, type PageViewRow, type ProductAnalyticsRow } from '@/lib/analytics/summary';
import { utcDay } from '@/lib/orders/stats';
import { fetchAllRows } from '@/lib/supabase/paginate';

export type AnalyticsData = { summary: AnalyticsSummary; products: { top: ProductAnalyticsRow[]; leaks: ProductAnalyticsRow[] } };

/** Lo que devuelve analytics_summary (migración 20261123): agregado en SQL, sin el tope de filas de PostgREST. */
export type AnalyticsSummaryRpc = {
  funnel: FunnelRow[];
  orders: OrderDayRow[];
  page_views: PageViewRow[];
  /** Fichas de producto vistas por día (suma de todos los productos). */
  item_views: PageViewRow[];
  items: { item_id: string; views: number; adds: number; units: number }[];
};

/** Normaliza el JSON de la función (cada lista vacía es `[]`). */
export const parseAnalyticsSummary = (data: unknown): AnalyticsSummaryRpc => {
  const raw = (data ?? {}) as Partial<Record<keyof AnalyticsSummaryRpc, unknown>>;
  const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return { funnel: list(raw.funnel), orders: list(raw.orders), page_views: list(raw.page_views), item_views: list(raw.item_views), items: list(raw.items) };
};

/**
 * Analítica del negocio activo (RLS: sólo sus miembros): el periodo y el
 * anterior, en una sola lectura agregada en la base. null si algo no se puede
 * leer (p. ej. la migración del recorrido aún no está aplicada).
 */
export async function getAnalytics(ctx: BusinessContext, range: AnalyticsRange, today = new Date()): Promise<AnalyticsData | null> {
  const since = analyticsWindowStart(today, range);
  const currentFrom = utcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (range - 1))));
  const id = ctx.business.id;
  try {
    const [summaryResult, items] = await Promise.all([
      ctx.supabase.rpc('analytics_summary', { p_business: id, p_since: since, p_until: utcDay(today), p_items_since: currentFrom }),
      // Nombres de los productos: por páginas (PostgREST corta en 1000 filas).
      fetchAllRows((from, to) => ctx.supabase.from('catalog_items').select('id, name').eq('business_id', id).is('deleted_at', null).order('id').range(from, to)),
    ]);
    if (summaryResult.error) {
      console.error('[analytics] no se pudo leer la analítica', { code: summaryResult.error.code });
      return null;
    }
    const data = parseAnalyticsSummary(summaryResult.data);
    const summary = summarizeAnalytics({ funnel: data.funnel, orders: data.orders, pageViews: data.page_views }, today, range);
    const byItem = <K extends 'views' | 'adds' | 'units'>(key: K) => new Map(data.items.map((row) => [row.item_id, row[key]]));
    const products = productAnalytics(items, byItem('views'), byItem('adds'), byItem('units'));
    return { summary, products };
  } catch (error) {
    console.error('[analytics] no se pudo leer la analítica', { code: (error as { code?: string }).code });
    return null;
  }
}
