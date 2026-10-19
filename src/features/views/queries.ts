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
