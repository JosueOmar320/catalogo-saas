'use server';

import { requireBusinessContext } from '@/lib/auth/session';
import { afterCatalogChange } from '@/lib/catalog/cache';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput, uuidSchema } from '@/lib/utils/validation';
import { msg } from '@/i18n/translate';
import { isValidMediaPath, releaseStorageObjects } from '@/features/media/server';
import { categoryFormSchema, type CategoryFormValues } from './schema';

export async function createCategory(input: CategoryFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(categoryFormSchema, input);
  if (!parsed.success) return parsed.result;
  if (!isValidMediaPath(ctx, parsed.data.imagePath)) return fail(msg('Imagen inválida.'));

  const { data: last } = await ctx.supabase
    .from('categories')
    .select('position')
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await ctx.supabase
    .from('categories')
    .insert({
      business_id: ctx.business.id,
      catalog_id: ctx.catalog.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      image_path: parsed.data.imagePath,
      is_active: parsed.data.isActive,
      position: (last?.position ?? -1) + 1,
    })
    .select('id')
    .single();
  if (error) return fail(dbErrorMessage(error));
  afterCatalogChange(ctx);
  return ok({ id: data.id }, msg('Categoría creada'));
}

export async function updateCategory(id: string, input: CategoryFormValues): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail(msg('Categoría inválida.'));
  const parsed = parseInput(categoryFormSchema, input);
  if (!parsed.success) return parsed.result;
  if (!isValidMediaPath(ctx, parsed.data.imagePath)) return fail(msg('Imagen inválida.'));

  const { data: current } = await ctx.supabase
    .from('categories')
    .select('image_path')
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id)
    .maybeSingle();
  if (!current) return fail(msg('La categoría ya no existe.'));

  const { error } = await ctx.supabase
    .from('categories')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      image_path: parsed.data.imagePath,
      is_active: parsed.data.isActive,
    })
    .eq('id', id);
  if (error) return fail(dbErrorMessage(error));
  if (current.image_path && current.image_path !== parsed.data.imagePath) {
    await releaseStorageObjects(ctx, [current.image_path]);
  }
  afterCatalogChange(ctx);
  return ok(undefined, msg('Categoría actualizada'));
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail(msg('Categoría inválida.'));
  const { error } = await ctx.supabase
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterCatalogChange(ctx);
  return ok(undefined, isActive ? msg('Categoría visible') : msg('Categoría oculta'));
}

/** Borra la categoría (lógicamente). Sus ítems pasan a "Sin categoría". */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail(msg('Categoría inválida.'));
  const { error: itemsError } = await ctx.supabase
    .from('catalog_items')
    .update({ category_id: null })
    .eq('category_id', id)
    .eq('catalog_id', ctx.catalog.id);
  if (itemsError) return fail(dbErrorMessage(itemsError));
  const { error } = await ctx.supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterCatalogChange(ctx);
  return ok(undefined, msg('Categoría eliminada'));
}
