'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireBusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import { msg } from '@/i18n/translate';

const reorderSchema = z.object({
  table: z.enum(['categories', 'catalog_items', 'catalog_item_images']),
  ids: z.array(z.uuid()).min(1).max(2000),
});

/** Guarda un nuevo orden. RLS limita la actualización a filas del negocio. */
export async function reorder(input: z.input<typeof reorderSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(reorderSchema, input);
  if (!parsed.success) return parsed.result;
  const { error } = await ctx.supabase.rpc('reorder_rows', { p_table: parsed.data.table, p_ids: parsed.data.ids });
  if (error) return fail(dbErrorMessage(error, msg('No se pudo guardar el orden.')));
  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, msg('Orden guardado'));
}
