'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput, uuidSchema } from '@/lib/utils/validation';
import { isValidMediaPath, removeStorageObjects } from '@/features/media/server';
import { categoryFormSchema, type CategoryFormValues } from './schema';

function afterChange(ctx: BusinessContext) {
  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
}

export async function createCategory(input: CategoryFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(categoryFormSchema, input);
  if (!parsed.success) return parsed.result;
  if (!isValidMediaPath(ctx, parsed.data.imagePath, 'category')) return fail('Imagen inválida.');

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
  afterChange(ctx);
  return ok({ id: data.id }, 'Categoría creada');
}

export async function updateCategory(id: string, input: CategoryFormValues): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail('Categoría inválida.');
  const parsed = parseInput(categoryFormSchema, input);
  if (!parsed.success) return parsed.result;
  if (!isValidMediaPath(ctx, parsed.data.imagePath, 'category')) return fail('Imagen inválida.');

  const { data: current } = await ctx.supabase
    .from('categories')
    .select('image_path')
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id)
    .maybeSingle();
  if (!current) return fail('La categoría ya no existe.');

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
    await removeStorageObjects(ctx, [current.image_path]);
  }
  afterChange(ctx);
  return ok(undefined, 'Categoría actualizada');
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail('Categoría inválida.');
  const { error } = await ctx.supabase
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterChange(ctx);
  return ok(undefined, isActive ? 'Categoría visible' : 'Categoría oculta');
}

/** Borra la categoría (lógicamente). Sus ítems pasan a "Sin categoría". */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail('Categoría inválida.');
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
  afterChange(ctx);
  return ok(undefined, 'Categoría eliminada');
}
