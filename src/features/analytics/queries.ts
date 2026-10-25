import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { analyticsWindowStart, productAnalytics, summarizeAnalytics, type AnalyticsRange, type AnalyticsSummary, type ProductAnalyticsRow } from '@/lib/analytics/summary';
import { utcDay } from '@/lib/orders/stats';

export type AnalyticsData = { summary: AnalyticsSummary; products: { top: ProductAnalyticsRow[]; leaks: ProductAnalyticsRow[] } };

const sumBy = <K extends string>(rows: ({ item_id: string } & Record<K, number>)[], key: K) => {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.item_id, (totals.get(row.item_id) ?? 0) + row[key]);
  return totals;
};

/**
 * Analítica del negocio activo (RLS: sólo sus miembros): el periodo y el
 * anterior, en una sola lectura de cada contador. null si algo no se puede
 * leer (p. ej. la migración del recorrido aún no está aplicada).
 */
export async function getAnalytics(ctx: BusinessContext, range: AnalyticsRange, today = new Date()): Promise<AnalyticsData | null> {
  const since = analyticsWindowStart(today, range);
  const currentFrom = utcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (range - 1))));
  const id = ctx.business.id;
  const [funnel, orders, pageViews, itemViews, itemAdds, itemUnits, items] = await Promise.all([
    ctx.supabase.from('funnel_stats_daily').select('day, source, sessions, viewed_product, started_cart, sent_order').eq('business_id', id).gte('day', since).limit(5000),
    ctx.supabase.from('order_stats_daily').select('day, orders, units, value').eq('business_id', id).gte('day', since),
    ctx.supabase.from('site_view_stats_daily').select('day, views').eq('business_id', id).gte('day', since),
    ctx.supabase.from('item_view_stats_daily').select('item_id, views').eq('business_id', id).gte('day', currentFrom).limit(20000),
    ctx.supabase.from('item_cart_stats_daily').select('item_id, adds').eq('business_id', id).gte('day', currentFrom).limit(20000),
    ctx.supabase.from('order_item_stats_daily').select('item_id, units').eq('business_id', id).gte('day', currentFrom).limit(20000),
    ctx.supabase.from('catalog_items').select('id, name').eq('business_id', id).is('deleted_at', null).limit(5000),
  ]);
  const failed = [funnel, orders, pageViews, itemViews, itemAdds, itemUnits, items].find((result) => result.error);
  if (failed) {
    console.error('[analytics] no se pudo leer la analítica', { code: failed.error?.code });
    return null;
  }
  const summary = summarizeAnalytics({ funnel: funnel.data!, orders: orders.data!, pageViews: pageViews.data! }, today, range);
  const products = productAnalytics(items.data!, sumBy(itemViews.data!, 'views'), sumBy(itemAdds.data!, 'adds'), sumBy(itemUnits.data!, 'units'));
  return { summary, products };
}
