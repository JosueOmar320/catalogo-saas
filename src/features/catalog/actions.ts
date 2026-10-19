'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { msg } from '@/i18n/translate';
import { canManageCatalog, requireBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import {
  catalogSettingsSchema,
  contactActionsSchema,
  parseCatalogSettings,
  pdfOptionsSchema,
  priceFormatSchema,
  seoSchema,
  CURRENCIES,
} from '@/lib/catalog/settings';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import type { Json, TablesUpdate } from '@/types/database';
import { isValidMediaPath, releaseStorageObjects } from '@/features/media/server';

async function updateCatalog(ctx: BusinessContext, patch: TablesUpdate<'catalogs'>, message: string): Promise<ActionResult> {
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede cambiar esto.'));
  const { error } = await ctx.supabase.from('catalogs').update(patch).eq('id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, message);
}

const catalogMediaSchema = z.object({
  field: z.enum(['cover_path', 'favicon_path']),
  path: z.string().max(300).nullable(),
});

/** Portada o favicon. Reemplazar borra el archivo anterior. */
export async function setCatalogMedia(input: z.input<typeof catalogMediaSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(catalogMediaSchema, input);
  if (!parsed.success) return parsed.result;
  const { field, path } = parsed.data;
  if (!isValidMediaPath(ctx, path)) return fail(msg('Imagen inválida.'));

  const previous = ctx.catalog[field];
  const result = await updateCatalog(ctx, { [field]: path } as Pick<TablesUpdate<'catalogs'>, typeof field>, path ? msg('Imagen actualizada') : msg('Imagen eliminada'));
  if (result.ok && previous && previous !== path) await releaseStorageObjects(ctx, [previous]);
  return result;
}

const settingsPatchSchema = z.object({
  currency: z.enum(CURRENCIES).optional(),
  language: z.enum(LOCALES).optional(),
  contactActions: contactActionsSchema.optional(),
  pdf: pdfOptionsSchema.optional(),
  priceFormat: priceFormatSchema.optional(),
});

/** Actualiza parcialmente catalogs.settings, validando el resultado completo. */
export async function updateCatalogSettings(input: z.input<typeof settingsPatchSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(settingsPatchSchema, input);
  if (!parsed.success) return parsed.result;
  const current = parseCatalogSettings(ctx.catalog.settings);
  const next = catalogSettingsSchema.safeParse({ ...current, ...parsed.data });
  if (!next.success) return fail(msg('Revisa la configuración: hay valores inválidos.'));
  return updateCatalog(ctx, { settings: next.data as Json }, msg('Configuración guardada'));
}

export async function saveSeo(input: z.input<typeof seoSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(seoSchema, input);
  if (!parsed.success) return parsed.result;
  if (!isValidMediaPath(ctx, parsed.data.ogImagePath)) return fail(msg('Imagen inválida.'));
  return updateCatalog(ctx, { seo: parsed.data as Json }, msg('SEO guardado'));
}

export async function publishCatalog(): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  return updateCatalog(ctx, { status: 'published', published_at: new Date().toISOString() }, msg('¡Tu catálogo está publicado!'));
}

export async function unpublishCatalog(): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  return updateCatalog(ctx, { status: 'unpublished' }, msg('El catálogo ya no es público'));
}
