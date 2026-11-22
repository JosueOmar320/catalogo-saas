import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { listItemPerformance } from '@/features/views/queries';
import { summarizeOrders, windowStart, type OrderStatsSummary } from '@/lib/orders/stats';

/**
 * Pedidos por WhatsApp de los últimos 30 días del negocio activo (RLS: sólo
 * sus miembros). Devuelve null si no se pueden leer (p. ej. la migración aún no
 * está aplicada): el inicio del panel simplemente no muestra la tarjeta.
 */
export async function getOrderStats(ctx: BusinessContext, today = new Date()): Promise<OrderStatsSummary | null> {
  const since = windowStart(today);
  try {
    const [days, items] = await Promise.all([
      ctx.supabase.from('order_stats_daily').select('day, orders, units, value').eq('business_id', ctx.business.id).gte('day', since),
      // Unidades por producto agregadas en la base (sin el tope de 1000 filas de PostgREST).
      listItemPerformance(ctx, since),
    ]);
    if (days.error) throw days.error;
    return summarizeOrders(days.data, items, today);
  } catch (error) {
    console.error('[orders] no se pudieron leer las estadísticas', { code: (error as { code?: string }).code });
    return null;
  }
}
