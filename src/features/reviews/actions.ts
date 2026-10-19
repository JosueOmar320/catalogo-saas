'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { requireBusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';

const moderateSchema = z.object({ id: z.uuid(), status: z.enum(['pending', 'approved', 'rejected']) });

const MESSAGES = { approved: msg('Reseña publicada'), rejected: msg('Reseña rechazada'), pending: msg('Reseña devuelta a pendientes') };

/** Aprobar (se publica), rechazar o devolver a pendientes. RLS: sólo miembros del negocio. */
export async function moderateReview(input: z.input<typeof moderateSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(moderateSchema, input);
  if (!parsed.success) return parsed.result;
  const { id, status } = parsed.data;
  const { data, error } = await ctx.supabase
    .from('reviews')
    .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', ctx.business.id)
    .select('id');
  if (error) return fail(dbErrorMessage(error));
  if (!data.length) return fail(msg('La reseña ya no existe.'));
  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, MESSAGES[status]);
}

/** Elimina una reseña para siempre (p. ej. spam). */
export async function deleteReview(id: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(z.uuid(), id);
  if (!parsed.success) return parsed.result;
  const { data, error } = await ctx.supabase.from('reviews').delete().eq('id', parsed.data).eq('business_id', ctx.business.id).select('id');
  if (error) return fail(dbErrorMessage(error));
  if (!data.length) return fail(msg('La reseña ya no existe.'));
  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, msg('Reseña eliminada'));
}
