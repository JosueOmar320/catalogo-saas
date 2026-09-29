'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { env } from '@/lib/env';
import { isWithinLimit } from '@/lib/plans/entitlements';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { slugify, withRandomSuffix } from '@/lib/utils/slug';
import { isPathOwnedBy } from '@/lib/utils/storage';
import { parseInput, uuidSchema } from '@/lib/utils/validation';
import type { Json, TablesUpdate } from '@/types/database';
import { removeStorageObjects } from '@/features/media/server';
import { parseAttributeDefs, parseAttributeValues } from '@/lib/catalog/attributes';
import { itemFormSchema, itemFormToAttributes, itemFormToRow, type ItemFormValues } from './schema';

function afterChange(ctx: BusinessContext) {
  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
}

async function nextPosition(ctx: BusinessContext): Promise<number> {
  const { data } = await ctx.supabase
    .from('catalog_items')
    .select('position')
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? -1) + 1;
}

async function categoryBelongsToCatalog(ctx: BusinessContext, categoryId: string | null): Promise<boolean> {
  if (!categoryId) return true;
  const { data } = await ctx.supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .maybeSingle();
  return Boolean(data);
}

/** Crea o actualiza un ítem y sincroniza su galería en una sola operación. */
export async function saveItem(itemId: string | null, input: ItemFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(itemFormSchema, input);
  if (!parsed.success) return parsed.result;
  const values = parsed.data;
  if (itemId && !uuidSchema.safeParse(itemId).success) return fail('Ítem inválido.');

  const { max_images_per_item: maxImages, max_items: maxItems } = ctx.entitlements.limits;
  if (maxImages !== null && values.images.length > maxImages) {
    return fail(`Tu plan permite hasta ${maxImages} imágenes por ítem.`);
  }
  for (const image of values.images) {
    if (!isPathOwnedBy(image.path, ctx.business.id, 'items') || (image.thumbPath && !isPathOwnedBy(image.thumbPath, ctx.business.id, 'items'))) {
      return fail('Una de las imágenes no es válida. Vuelve a subirla.');
    }
  }
  // attributes es extensible: se conservan claves desconocidas y se actualizan las del formulario.
  let existingAttributes: Record<string, unknown> = {};
  if (itemId) {
    const { data } = await ctx.supabase.from('catalog_items').select('attributes').eq('id', itemId).eq('catalog_id', ctx.catalog.id).maybeSingle();
    if (data?.attributes && typeof data.attributes === 'object' && !Array.isArray(data.attributes)) existingAttributes = data.attributes as Record<string, unknown>;
  }
  const defs = parseAttributeDefs(ctx.catalog.attribute_defs);
  const attributes = { ...existingAttributes, ...itemFormToAttributes(values), values: parseAttributeValues(values.attributeValues, defs) };
  const row = { ...itemFormToRow(values), attributes: attributes as Json };
  if (!(await categoryBelongsToCatalog(ctx, row.category_id))) return fail('La categoría ya no existe.');

  let id = itemId;
  if (id) {
    const { data: updated, error } = await ctx.supabase
      .from('catalog_items')
      .update(row)
      .eq('id', id)
      .eq('catalog_id', ctx.catalog.id)
      .is('deleted_at', null)
      .select('id');
    if (error) return fail(dbErrorMessage(error));
    if (!updated?.length) return fail('El ítem ya no existe.');
  } else {
    const { count } = await ctx.supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', ctx.business.id)
      .is('deleted_at', null);
    if (!isWithinLimit(maxItems, count ?? 0)) return fail(`Tu plan permite hasta ${maxItems} ítems.`);

    const base = slugify(values.name, 60) || 'item';
    const position = await nextPosition(ctx);
    for (const slug of [base, withRandomSuffix(base), withRandomSuffix(base)]) {
      const { data, error } = await ctx.supabase
        .from('catalog_items')
        .insert({ ...row, slug, position, business_id: ctx.business.id, catalog_id: ctx.catalog.id })
        .select('id')
        .single();
      if (!error) {
        id = data.id;
        break;
      }
      if (error.code !== '23505') return fail(dbErrorMessage(error));
    }
    if (!id) return fail('No se pudo generar una URL única para el ítem.');
  }

  const imageError = await syncImages(ctx, id, values.images);
  if (imageError) return fail(imageError);

  afterChange(ctx);
  return ok({ id }, itemId ? 'Cambios guardados' : 'Ítem creado');
}

type ParsedImage = z.output<typeof itemFormSchema>['images'][number];

async function syncImages(ctx: BusinessContext, itemId: string, images: ParsedImage[]): Promise<string | null> {
  const { data: existing, error } = await ctx.supabase.from('catalog_item_images').select('*').eq('item_id', itemId);
  if (error) return dbErrorMessage(error);

  const keepIds = new Set(images.flatMap((i) => (i.id ? [i.id] : [])));
  const removed = existing.filter((img) => !keepIds.has(img.id));
  if (removed.length > 0) {
    const { error: deleteError } = await ctx.supabase
      .from('catalog_item_images')
      .delete()
      .in('id', removed.map((r) => r.id));
    if (deleteError) return dbErrorMessage(deleteError);
    await removeStorageObjects(ctx, removed.flatMap((r) => [r.storage_path, r.thumb_path]));
  }

  const existingIds = new Set(existing.map((e) => e.id));
  for (const [position, image] of images.entries()) {
    const fields = {
      position,
      alt: image.alt || null,
    };
    if (image.id && existingIds.has(image.id)) {
      const { error: updateError } = await ctx.supabase.from('catalog_item_images').update(fields).eq('id', image.id);
      if (updateError) return dbErrorMessage(updateError);
    } else {
      const { error: insertError } = await ctx.supabase.from('catalog_item_images').insert({
        ...fields,
        business_id: ctx.business.id,
        item_id: itemId,
        storage_path: image.path,
        thumb_path: image.thumbPath,
        width: image.width,
        height: image.height,
        size_bytes: image.sizeBytes,
        mime_type: image.mimeType,
      });
      if (insertError) return dbErrorMessage(insertError, 'No se pudo guardar una imagen.');
    }
  }
  return null;
}

const toggleSchema = z.object({
  id: z.uuid(),
  field: z.enum(['is_visible', 'is_available', 'is_featured']),
  value: z.boolean(),
});

export async function toggleItemField(input: z.input<typeof toggleSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(toggleSchema, input);
  if (!parsed.success) return parsed.result;
  const { id, field, value } = parsed.data;
  const { error } = await ctx.supabase
    .from('catalog_items')
    .update({ [field]: value } as Pick<TablesUpdate<'catalog_items'>, typeof field>)
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterChange(ctx);
  return ok(undefined);
}

/** Borrado lógico: el ítem desaparece del catálogo y del panel (recuperable desde la BD). */
export async function deleteItem(id: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail('Ítem inválido.');
  const { error } = await ctx.supabase
    .from('catalog_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterChange(ctx);
  return ok(undefined, 'Ítem eliminado');
}

/** Duplica un ítem (oculto) copiando también sus archivos de imagen. */
export async function duplicateItem(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail('Ítem inválido.');

  const { data: source } = await ctx.supabase
    .from('catalog_items')
    .select('*')
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return fail('El ítem ya no existe.');

  const { id: _id, created_at: _c, updated_at: _u, deleted_at: _d, slug, name, ...rest } = source;
  const copyName = `${name} (copia)`.slice(0, 160);
  const { data: copy, error } = await ctx.supabase
    .from('catalog_items')
    .insert({ ...rest, name: copyName, slug: withRandomSuffix(slug), is_visible: false, position: await nextPosition(ctx) })
    .select('id')
    .single();
  if (error) return fail(dbErrorMessage(error));

  const { data: images } = await ctx.supabase.from('catalog_item_images').select('*').eq('item_id', id).order('position');
  const bucket = ctx.supabase.storage.from(env.storageBucket);
  for (const image of images ?? []) {
    const newPath = `${ctx.business.id}/items/${crypto.randomUUID()}.${image.storage_path.split('.').pop()}`;
    const newThumb = image.thumb_path ? `${ctx.business.id}/items/${crypto.randomUUID()}.${image.thumb_path.split('.').pop()}` : null;
    const copied = await bucket.copy(image.storage_path, newPath);
    if (copied.error) continue;
    if (image.thumb_path && newThumb) await bucket.copy(image.thumb_path, newThumb);
    const { id: _imgId, created_at: _ic, updated_at: _iu, ...imageRest } = image;
    await ctx.supabase
      .from('catalog_item_images')
      .insert({ ...imageRest, item_id: copy.id, storage_path: newPath, thumb_path: newThumb });
  }

  afterChange(ctx);
  return ok({ id: copy.id }, 'Ítem duplicado (oculto hasta que lo actives)');
}
