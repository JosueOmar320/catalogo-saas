'use server';

import { revalidatePath } from 'next/cache';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { pdfSettingsSchema, type PdfSettingsInput } from '@/lib/pdf/settings';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { collectMediaPaths, isPathOwnedBy } from '@/lib/utils/storage';
import type { Json } from '@/types/database';

export async function savePdfSettings(input: PdfSettingsInput): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail('Sólo el dueño o un administrador puede cambiar esto.');
  const parsed = pdfSettingsSchema.safeParse(input);
  if (!parsed.success) return fail('Revisa la configuración del PDF.');
  if (collectMediaPaths(parsed.data).some((path) => !isPathOwnedBy(path, ctx.business.id))) return fail('Una de las imágenes no es válida.');
  const { error } = await ctx.supabase.from('catalogs').update({ pdf: parsed.data as Json }).eq('id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath('/dashboard/export/pdf');
  return ok(undefined, 'Configuración del PDF guardada');
}
