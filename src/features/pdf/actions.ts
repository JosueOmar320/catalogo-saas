'use server';

import { revalidatePath } from 'next/cache';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { pdfSettingsSchema, type PdfSettingsInput } from '@/lib/pdf/settings';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { collectMediaPaths } from '@/lib/utils/storage';
import { invalidMediaRefs } from '@/features/media/server';
import type { Json } from '@/types/database';
import { msg } from '@/i18n/translate';

export async function savePdfSettings(input: PdfSettingsInput): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede cambiar esto.'));
  const parsed = pdfSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(msg('Revisa la configuración del PDF.'));
  if ((await invalidMediaRefs(ctx, collectMediaPaths(parsed.data))).length > 0) return fail(msg('Una de las imágenes no es válida.'));
  const { error } = await ctx.supabase.from('catalogs').update({ pdf: parsed.data as Json }).eq('id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath('/dashboard/export/pdf');
  return ok(undefined, msg('Configuración del PDF guardada'));
}
