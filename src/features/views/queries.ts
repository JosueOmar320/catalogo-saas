import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { windowStart } from '@/lib/orders/stats';
import { summarizeViews, type ViewStatsSummary } from '@/lib/views/stats';

/**
 * Visitas del sitio publicado de los últimos 30 días del negocio activo (RLS:
 * sólo sus miembros). null si no se pueden leer (p. ej. la migración aún no
 * está aplicada): el inicio del panel simplemente no muestra la tarjeta.
 */
export async function getViewStats(ctx: BusinessContext, today = new Date()): Promise<ViewStatsSummary | null> {
  const since = windowStart(today);
  const [days, items] = await Promise.all([
    ctx.supabase.from('site_view_stats_daily').select('day, views').eq('business_id', ctx.business.id).gte('day', since),
    ctx.supabase.from('item_view_stats_daily').select('item_id, views').eq('business_id', ctx.business.id).gte('day', since).limit(5000),
  ]);
  if (days.error || items.error) {
    console.error('[views] no se pudieron leer las visitas', { code: days.error?.code ?? items.error?.code });
    return null;
  }
  return summarizeViews(days.data, items.data, today);
}

export type ItemPerformance = {
  /** Fichas vistas por producto (null si las visitas aún no se pueden leer). */
  views: Record<string, number> | null;
  /** Unidades pedidas por producto. */
  units: Record<string, number> | null;
};

/** Visitas y pedidos de cada producto en los últimos 30 días (para la lista de productos y servicios). */
export async function getItemPerformance(ctx: BusinessContext, today = new Date()): Promise<ItemPerformance> {
  const since = windowStart(today);
  const [views, units] = await Promise.all([
    ctx.supabase.from('item_view_stats_daily').select('item_id, views').eq('business_id', ctx.business.id).gte('day', since).limit(10000),
    ctx.supabase.from('order_item_stats_daily').select('item_id, units').eq('business_id', ctx.business.id).gte('day', since).limit(10000),
  ]);
  const sum = <K extends 'views' | 'units'>(rows: ({ item_id: string } & Record<K, number>)[], key: K) => {
    const totals: Record<string, number> = {};
    for (const row of rows) totals[row.item_id] = (totals[row.item_id] ?? 0) + row[key];
    return totals;
  };
  return { views: views.error ? null : sum(views.data, 'views'), units: units.error ? null : sum(units.data, 'units') };
}
