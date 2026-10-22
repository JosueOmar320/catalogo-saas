import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import type { Customer, CustomerSort } from '@/lib/orders/customers';
import type { Database } from '@/types/database';

type Row = Database['public']['Views']['customer_summaries']['Row'];

/** Tope de la lista (la página avisa al llegar). */
export const CUSTOMERS_PAGE = 500;

const toCustomer = (row: Row): Customer => ({
  key: row.key,
  name: row.name,
  phone: row.phone,
  orders: row.orders,
  delivered: row.delivered,
  spent: Number(row.spent),
  currency: row.currency,
  firstOrderAt: row.first_order_at,
  lastOrderAt: row.last_order_at,
});

/** Clientes del negocio activo (RLS de orders). null si no se pueden leer (p. ej. sin la migración). */
export async function listCustomers(ctx: BusinessContext, { sort, query = '' }: { sort: CustomerSort; query?: string }): Promise<Customer[] | null> {
  let request = ctx.supabase.from('customer_summaries').select('*').eq('business_id', ctx.business.id).gt('orders', 0).order(sort.column, { ascending: false }).limit(CUSTOMERS_PAGE);
  const term = query.trim().replace(/[%,()]/g, '').slice(0, 60);
  if (term) request = request.or(`name.ilike.%${term}%,phone.ilike.%${term.replace(/\D/g, '') || term}%`);
  const { data, error } = await request;
  if (error) {
    console.error('[customers] no se pudieron leer los clientes', { code: error.code });
    return null;
  }
  return data.map(toCustomer);
}

/** Pedidos (no cancelados) de cada cliente de la lista: para marcar a los frecuentes en la bandeja. */
export async function orderCountsByCustomer(ctx: BusinessContext, keys: (string | null)[]): Promise<Record<string, number>> {
  const unique = [...new Set(keys.filter((key): key is string => Boolean(key)))].slice(0, 300);
  if (!unique.length) return {};
  const { data, error } = await ctx.supabase.from('customer_summaries').select('key, orders').eq('business_id', ctx.business.id).in('key', unique);
  return error ? {} : Object.fromEntries(data.map((row) => [row.key, row.orders]));
}
