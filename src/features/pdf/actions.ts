'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { pdfSettingsSchema, type PdfSettingsInput } from '@/lib/pdf/settings';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { collectMediaPaths } from '@/lib/utils/storage';
import { invalidMediaRefs } from '@/features/media/server';
import type { Json } from '@/types/database';
import { msg } from '@/i18n/translate';

/** `updated_at` del catálogo tal como lo devuelve la base (ISO con microsegundos). */
const updatedAtSchema = z.string().max(60).refine((v) => !Number.isNaN(Date.parse(v))).nullable();

/**
 * Guarda la configuración del PDF. `expectedUpdatedAt`: el `updated_at` del
 * catálogo que cargó el estudio; si otra persona guardó después, no se pisa
 * nada y se avisa. Devuelve el `updated_at` nuevo para el siguiente guardado.
 */
export async function savePdfSettings(input: PdfSettingsInput, expectedUpdatedAt: string | null = null): Promise<ActionResult<{ updatedAt: string | null }>> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede cambiar esto.'));
  const expected = updatedAtSchema.safeParse(expectedUpdatedAt);
  if (!expected.success) return fail(msg('Revisa la configuración del PDF.'));
  const parsed = pdfSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(msg('Revisa la configuración del PDF.'));
  if ((await invalidMediaRefs(ctx, collectMediaPaths(parsed.data))).length > 0) return fail(msg('Una de las imágenes no es válida.'));
  let query = ctx.supabase.from('catalogs').update({ pdf: parsed.data as Json }).eq('id', ctx.catalog.id);
  if (expected.data) query = query.eq('updated_at', expected.data);
  const { data, error } = await query.select('updated_at').maybeSingle();
  if (error) return fail(dbErrorMessage(error));
  // Ninguna fila: el catálogo cambió desde que se cargó (o ya no existe).
  if (!data) return fail(msg('Otra persona modificó el sitio. Recarga la página.'));
  revalidatePath('/dashboard/export/pdf');
  return ok({ updatedAt: data.updated_at ?? null }, msg('Configuración del PDF guardada'));
}
