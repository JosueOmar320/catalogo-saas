import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { summarizeOrders, windowStart, type OrderStatsSummary } from '@/lib/orders/stats';

/**
 * Pedidos por WhatsApp de los últimos 30 días del negocio activo (RLS: sólo
 * sus miembros). Devuelve null si no se pueden leer (p. ej. la migración aún no
 * está aplicada): el inicio del panel simplemente no muestra la tarjeta.
 */
export async function getOrderStats(ctx: BusinessContext, today = new Date()): Promise<OrderStatsSummary | null> {
  const since = windowStart(today);
  const [days, items] = await Promise.all([
    ctx.supabase.from('order_stats_daily').select('day, orders, units, value').eq('business_id', ctx.business.id).gte('day', since),
    ctx.supabase.from('order_item_stats_daily').select('item_id, units').eq('business_id', ctx.business.id).gte('day', since).limit(5000),
  ]);
  if (days.error || items.error) {
    console.error('[orders] no se pudieron leer las estadísticas', { code: days.error?.code ?? items.error?.code });
    return null;
  }
  return summarizeOrders(days.data, items.data, today);
}
