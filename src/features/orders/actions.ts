'use server';

import { revalidatePath } from 'next/cache';
import { msg } from '@/i18n/translate';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { ORDER_STATUSES } from '@/lib/orders/inbox';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { uuidSchema } from '@/lib/utils/validation';
import type { OrderStatus } from '@/types/database';

/** Cambia el estado de un pedido (la base descuenta o devuelve existencias si el negocio lo activó). */
export async function changeOrderStatus(id: string, status: OrderStatus): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success || !ORDER_STATUSES.includes(status)) return fail(msg('Datos inválidos.'));
  const { error } = await ctx.supabase.rpc('set_order_status', { p_order: id, p_status: status });
  if (error) return fail(error.message.includes('order_not_found') ? msg('Ese pedido ya no existe.') : dbErrorMessage(error, msg('No se pudo actualizar el pedido.')));
  revalidatePath('/dashboard', 'layout');
  return ok(undefined);
}

/** Borra un pedido de la bandeja (los contadores de estadísticas no cambian). */
export async function deleteOrder(id: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede borrar pedidos.'));
  if (!uuidSchema.safeParse(id).success) return fail(msg('Datos inválidos.'));
  const { error } = await ctx.supabase.from('orders').delete().eq('id', id).eq('business_id', ctx.business.id);
  if (error) return fail(dbErrorMessage(error, msg('No se pudo borrar el pedido.')));
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, msg('Pedido borrado'));
}
