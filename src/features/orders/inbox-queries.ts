import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import type { OrderStatus, Tables } from '@/types/database';

export type PanelOrder = Tables<'orders'>;

/** Tope de filas por consulta (la bandeja avisa cuando llega a él). */
export const PAGE = 300;
export const since = (days: number, now = Date.now()) => new Date(now - days * 86_400_000).toISOString();

/**
 * Pedidos del negocio activo (RLS: sólo sus miembros), los más recientes
 * primero. null si no se pueden leer (p. ej. la migración aún no está aplicada).
 */
export async function listOrders(ctx: BusinessContext, { statuses, days, query = '' }: { statuses: readonly OrderStatus[]; days: number; query?: string }): Promise<PanelOrder[] | null> {
  let request = ctx.supabase.from('orders').select('*').eq('business_id', ctx.business.id).in('status', [...statuses]).gte('created_at', since(days)).order('created_at', { ascending: false }).limit(PAGE);
  const term = query.trim().replace(/[%,()]/g, '').slice(0, 60);
  // El WhatsApp se busca por sus dígitos ("55 1234" encuentra +52 55 1234 5678).
  const digits = term.replace(/\D/g, '');
  if (term) request = request.or(`reference.ilike.%${term}%,customer_name.ilike.%${term}%${digits.length >= 4 ? `,customer_phone.ilike.%${digits}%` : ''}`);
  const { data, error } = await request;
  if (error) {
    console.error('[orders] no se pudieron leer los pedidos', { code: error.code });
    return null;
  }
  return data;
}

/** Pedidos nuevos (sin atender), para la pestaña, el menú y el inicio del panel. */
export async function countNewOrders(ctx: BusinessContext): Promise<number> {
  const { count } = await ctx.supabase.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', ctx.business.id).eq('status', 'new');
  return count ?? 0;
}
