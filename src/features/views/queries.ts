import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { windowStart } from '@/lib/orders/stats';
import { topSearchMisses, type SearchMiss } from '@/lib/catalog/search-misses';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { summarizeViews, type ViewStatsSummary } from '@/lib/views/stats';

export type ItemPerformanceRow = { item_id: string; views: number; units: number; carts: number };

/**
 * Visitas, unidades pedidas y veces agregado por producto desde `since`,
 * agregado en la base (item_performance, migración 20261123) y leído por
 * páginas: PostgREST corta en 1000 filas también las funciones. Lanza si no se
 * puede leer (p. ej. la migración aún no está aplicada).
 */
export function listItemPerformance(ctx: BusinessContext, since: string): Promise<ItemPerformanceRow[]> {
  return fetchAllRows<ItemPerformanceRow>((from, to) => ctx.supabase.rpc('item_performance', { p_business: ctx.business.id, p_since: since }).order('item_id').range(from, to));
}

/**
 * Visitas del sitio publicado de los últimos 30 días del negocio activo (RLS:
 * sólo sus miembros). null si no se pueden leer (p. ej. la migración aún no
 * está aplicada): el inicio del panel simplemente no muestra la tarjeta.
 */
export async function getViewStats(ctx: BusinessContext, today = new Date()): Promise<ViewStatsSummary | null> {
  const since = windowStart(today);
  try {
    const [days, items] = await Promise.all([
      ctx.supabase.from('site_view_stats_daily').select('day, views').eq('business_id', ctx.business.id).gte('day', since),
      listItemPerformance(ctx, since),
    ]);
    if (days.error) throw days.error;
    return summarizeViews(days.data, items, today);
  } catch (error) {
    console.error('[views] no se pudieron leer las visitas', { code: (error as { code?: string }).code });
    return null;
  }
}

export type ItemPerformance = {
  /** Fichas vistas por producto (null si las visitas aún no se pueden leer). */
  views: Record<string, number> | null;
  /** Unidades pedidas por producto. */
  units: Record<string, number> | null;
};

/** Visitas y pedidos de cada producto en los últimos 30 días (para la lista de productos y servicios). */
export async function getItemPerformance(ctx: BusinessContext, today = new Date()): Promise<ItemPerformance> {
  try {
    const rows = await listItemPerformance(ctx, windowStart(today));
    const views: Record<string, number> = {};
    const units: Record<string, number> = {};
    for (const row of rows) {
      views[row.item_id] = row.views;
      units[row.item_id] = row.units;
    }
    return { views, units };
  } catch {
    return { views: null, units: null };
  }
}

/**
 * Lo que buscaron en el sitio publicado y no encontraron (30 días), los más
 * buscados primero. null si no se puede leer (p. ej. sin la migración).
 */
export async function getSearchMisses(ctx: BusinessContext, today = new Date()): Promise<SearchMiss[] | null> {
  try {
    // Hasta 200 términos por día: por páginas (PostgREST corta en 1000 filas).
    const since = windowStart(today);
    const rows = await fetchAllRows((from, to) => ctx.supabase.from('search_miss_stats_daily').select('term, searches').eq('business_id', ctx.business.id).gte('day', since).order('day').order('term').range(from, to));
    return topSearchMisses(rows);
  } catch (error) {
    console.error('[search-misses] no se pudieron leer las búsquedas', { code: (error as { code?: string }).code });
    return null;
  }
}
