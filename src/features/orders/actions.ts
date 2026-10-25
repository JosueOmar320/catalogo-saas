'use server';

import { revalidatePath } from 'next/cache';
import { msg } from '@/i18n/translate';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { ORDER_STATUSES } from '@/lib/orders/inbox';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { uuidSchema } from '@/lib/utils/validation';
import type { OrderStatus } from '@/types/database';

/** Transiciones que ofrece la bandeja (OrdersBoard): el siguiente paso, cancelar, o volver a nuevo. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['new'],
  cancelled: ['new'],
};

/** Cambia el estado de un pedido (la base descuenta o devuelve existencias si el negocio lo activó). */
export async function changeOrderStatus(id: string, status: OrderStatus): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!ctx.features.orders) return fail(msg('La bandeja de pedidos no está disponible para tu cuenta.'));
  if (!uuidSchema.safeParse(id).success || !ORDER_STATUSES.includes(status)) return fail(msg('Datos inválidos.'));
  const { data: current } = await ctx.supabase.from('orders').select('status').eq('id', id).eq('business_id', ctx.business.id).maybeSingle();
  if (!current) return fail(msg('Ese pedido ya no existe.'));
  if (current.status === status) return ok(undefined);
  if (!ALLOWED_TRANSITIONS[current.status].includes(status)) return fail(msg('Ese cambio de estado no está permitido. Recarga la bandeja.'));
  const { error } = await ctx.supabase.rpc('set_order_status', { p_order: id, p_status: status });
  if (error) return fail(error.message.includes('order_not_found') ? msg('Ese pedido ya no existe.') : dbErrorMessage(error, msg('No se pudo actualizar el pedido.')));
  revalidatePath('/dashboard', 'layout');
  return ok(undefined);
}

/** Borra un pedido de la bandeja (los contadores de estadísticas no cambian). */
export async function deleteOrder(id: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!ctx.features.orders) return fail(msg('La bandeja de pedidos no está disponible para tu cuenta.'));
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede borrar pedidos.'));
  if (!uuidSchema.safeParse(id).success) return fail(msg('Datos inválidos.'));
  const { error } = await ctx.supabase.from('orders').delete().eq('id', id).eq('business_id', ctx.business.id);
  if (error) return fail(dbErrorMessage(error, msg('No se pudo borrar el pedido.')));
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, msg('Pedido borrado'));
}
