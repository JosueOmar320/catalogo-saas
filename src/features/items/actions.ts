'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requireBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { isWithinLimit } from '@/lib/plans/entitlements';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { slugify, withRandomSuffix } from '@/lib/utils/slug';
import { isPathOwnedBy } from '@/lib/utils/storage';
import { MAX_PHOTO_BATCH } from '@/lib/catalog/photo-names';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { uploadedImageSchema } from '@/features/media/schema';
import { parseInput, uuidSchema } from '@/lib/utils/validation';
import type { Json, TablesUpdate } from '@/types/database';
import { releaseStorageObjects } from '@/features/media/server';
import { parseAttributeDefs, parseAttributeValues } from '@/lib/catalog/attributes';
import { adjustPrice, isValidAdjustment, PRICE_ROUNDINGS } from '@/lib/catalog/price-adjust';
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
  if (itemId && !uuidSchema.safeParse(itemId).success) return fail(msg('Ítem inválido.'));

  const { max_images_per_item: maxImages, max_items: maxItems } = ctx.entitlements.limits;
  if (maxImages !== null && values.images.length > maxImages) {
    const t = await getT();
    return fail(t('Tu plan permite hasta {max} imágenes por ítem.', { max: maxImages }));
  }
  for (const image of values.images) {
    if (!isPathOwnedBy(image.path, ctx.business.id) || (image.thumbPath && !isPathOwnedBy(image.thumbPath, ctx.business.id))) {
      return fail(msg('Una de las imágenes no es válida. Vuelve a subirla.'));
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
  if (!(await categoryBelongsToCatalog(ctx, row.category_id))) return fail(msg('La categoría ya no existe.'));

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
    if (!updated?.length) return fail(msg('El ítem ya no existe.'));
  } else {
    const { count } = await ctx.supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', ctx.business.id)
      .is('deleted_at', null);
    if (!isWithinLimit(maxItems, count ?? 0)) {
      const t = await getT();
      return fail(t('Tu plan permite hasta {max} ítems.', { max: String(maxItems) }));
    }

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
    if (!id) return fail(msg('No se pudo generar una URL única para el ítem.'));
  }

  const imageError = await syncImages(ctx, id, values.images);
  if (imageError) return fail(imageError);

  afterChange(ctx);
  return ok({ id }, itemId ? msg('Cambios guardados') : msg('Ítem creado'));
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
    await releaseStorageObjects(ctx, removed.flatMap((r) => [r.storage_path, r.thumb_path]));
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
      if (insertError) return dbErrorMessage(insertError, msg('No se pudo guardar una imagen.'));
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
  if (!uuidSchema.safeParse(id).success) return fail(msg('Ítem inválido.'));
  const { error } = await ctx.supabase
    .from('catalog_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterChange(ctx);
  return ok(undefined, msg('Ítem eliminado'));
}

/** Duplica un ítem (oculto) copiando también sus archivos de imagen. */
export async function duplicateItem(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusinessContext();
  if (!uuidSchema.safeParse(id).success) return fail(msg('Ítem inválido.'));

  const { data: source } = await ctx.supabase
    .from('catalog_items')
    .select('*')
    .eq('id', id)
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return fail(msg('El ítem ya no existe.'));

  const { id: _id, created_at: _c, updated_at: _u, deleted_at: _d, slug, name, ...rest } = source;
  const t = await getT();
  const copyName = t('{name} (copia)', { name }).slice(0, 160);
  const { data: copy, error } = await ctx.supabase
    .from('catalog_items')
    .insert({ ...rest, name: copyName, slug: withRandomSuffix(slug), is_visible: false, position: await nextPosition(ctx) })
    .select('id')
    .single();
  if (error) return fail(dbErrorMessage(error));

  // Las fotos se comparten (misma ruta), como en el resto de la biblioteca: no se copian archivos.
  // Es seguro: un archivo sólo se borra cuando ningún ítem, página ni categoría lo usa (media_references).
  const { data: images, error: imagesError } = await ctx.supabase.from('catalog_item_images').select('*').eq('item_id', id).order('position');
  const rows = (images ?? []).map(({ id: _imgId, created_at: _ic, updated_at: _iu, ...image }) => ({ ...image, item_id: copy.id }));
  const { error: insertError } = imagesError ? { error: imagesError } : rows.length ? await ctx.supabase.from('catalog_item_images').insert(rows) : { error: null };
  if (insertError) {
    // Sin fotos la copia quedaría incompleta: se deshace en vez de dejarla a medias.
    await ctx.supabase.from('catalog_items').delete().eq('id', copy.id).eq('catalog_id', ctx.catalog.id);
    return fail(dbErrorMessage(insertError, msg('No se pudo duplicar el ítem.')));
  }

  afterChange(ctx);
  return ok({ id: copy.id }, msg('Ítem duplicado (oculto hasta que lo actives)'));
}

/* ------------------------------------------------------------ Acciones masivas */

const bulkSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('set'), field: z.enum(['is_visible', 'is_available', 'is_featured']), value: z.boolean() }),
    z.object({ type: z.literal('category'), categoryId: z.uuid().nullable() }),
    z.object({ type: z.literal('delete') }),
    z.object({ type: z.literal('price'), mode: z.enum(['percent', 'amount']), value: z.number(), rounding: z.enum(PRICE_ROUNDINGS) }),
  ]),
});

export type BulkItemsInput = z.input<typeof bulkSchema>;

/**
 * Cambia varios ítems a la vez (siempre dentro del catálogo activo; RLS
 * además impide tocar otros negocios). Devuelve cuántos cambiaron.
 */
export async function bulkUpdateItems(input: BulkItemsInput): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(bulkSchema, input);
  if (!parsed.success) return parsed.result;
  const { ids, action } = parsed.data;
  const scoped = () => ctx.supabase.from('catalog_items');

  let count = 0;
  if (action.type === 'price') {
    if (!isValidAdjustment(action)) return fail(msg('El ajuste debe estar entre -90 % y +500 % (o un monto distinto de cero).'));
    const { data, error } = await scoped().select('id, price, compare_at_price').in('id', ids).eq('catalog_id', ctx.catalog.id).is('deleted_at', null);
    if (error) return fail(dbErrorMessage(error));
    const changes = data.flatMap((row) => {
      const price = adjustPrice(row.price === null ? null : Number(row.price), action);
      if (price === null) return [];
      const compare = adjustPrice(row.compare_at_price === null ? null : Number(row.compare_at_price), action);
      // Un "precio anterior" que ya no es mayor que el nuevo dejaría de ser una oferta.
      return [{ id: row.id, price, compare_at_price: compare !== null && compare > price ? compare : null }];
    });
    for (let i = 0; i < changes.length; i += 20) {
      const results = await Promise.all(
        changes.slice(i, i + 20).map(({ id, ...values }) => scoped().update(values).eq('id', id).eq('catalog_id', ctx.catalog.id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) return fail(dbErrorMessage(failed.error));
    }
    count = changes.length;
  } else {
    if (action.type === 'category' && !(await categoryBelongsToCatalog(ctx, action.categoryId))) return fail(msg('Categoría inválida.'));
    const values: TablesUpdate<'catalog_items'> =
      action.type === 'set' ? { [action.field]: action.value } : action.type === 'category' ? { category_id: action.categoryId } : { deleted_at: new Date().toISOString() };
    const { data, error } = await scoped().update(values).in('id', ids).eq('catalog_id', ctx.catalog.id).is('deleted_at', null).select('id');
    if (error) return fail(dbErrorMessage(error));
    count = data.length;
  }

  afterChange(ctx);
  const t = await getT();
  return ok({ count }, count === 1 ? t('1 ítem actualizado') : t('{count} ítems actualizados', { count }));
}


/** Lista mínima para la búsqueda rápida del panel (⌘K): nombre, código y tipo. */
export async function listQuickItems(): Promise<ActionResult<{ id: string; name: string; sku: string | null; type: 'product' | 'service' }[]>> {
  const ctx = await requireBusinessContext();
  const { data, error } = await ctx.supabase
    .from('catalog_items')
    .select('id, name, sku, type')
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1000);
  if (error) return fail(dbErrorMessage(error));
  return ok(data);
}

const restoreSchema = z.array(z.uuid()).min(1).max(500);

/** "Deshacer" tras eliminar: vuelve a mostrar los ítems recién eliminados (borrado lógico). */
export async function restoreItems(ids: string[]): Promise<ActionResult<{ restored: number }>> {
  const ctx = await requireBusinessContext();
  const parsed = restoreSchema.safeParse(ids);
  if (!parsed.success) return fail(msg('Ítem inválido.'));
  const { data, error } = await ctx.supabase
    .from('catalog_items')
    .update({ deleted_at: null })
    .in('id', parsed.data)
    .eq('catalog_id', ctx.catalog.id)
    .not('deleted_at', 'is', null)
    .select('id');
  if (error) return fail(dbErrorMessage(error, msg('No se pudo restaurar. Si creaste otro ítem con el mismo nombre, cámbiale el nombre e intenta de nuevo.')));
  afterChange(ctx);
  return ok({ restored: data.length }, data.length === 1 ? msg('Ítem restaurado') : msg('Ítems restaurados'));
}

const priceSchema = z.object({ id: z.uuid(), price: z.number().min(0).max(99_999_999).nullable() });

/**
 * Edición rápida del precio desde la lista. Si el precio anterior (oferta)
 * deja de ser mayor que el nuevo, se quita, igual que en el ajuste masivo.
 */
export async function setItemPrice(input: z.input<typeof priceSchema>): Promise<ActionResult<{ price: number | null }>> {
  const ctx = await requireBusinessContext();
  const parsed = priceSchema.safeParse(input);
  if (!parsed.success) return fail(msg('Precio inválido.'));
  const { id, price } = parsed.data;
  const scoped = () => ctx.supabase.from('catalog_items');
  const { data: current, error: readError } = await scoped().select('compare_at_price').eq('id', id).eq('catalog_id', ctx.catalog.id).is('deleted_at', null).maybeSingle();
  if (readError) return fail(dbErrorMessage(readError));
  if (!current) return fail(msg('El ítem ya no existe.'));
  const compare = current.compare_at_price === null ? null : Number(current.compare_at_price);
  const values = { price, ...(compare !== null && (price === null || compare <= price) ? { compare_at_price: null } : {}) };
  const { error } = await scoped().update(values).eq('id', id).eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterChange(ctx);
  return ok({ price }, msg('Precio actualizado'));
}

const photoBatchSchema = z.object({
  type: z.enum(['product', 'service']),
  categoryId: z.uuid().nullable(),
  visible: z.boolean(),
  items: z
    .array(z.object({ name: z.string().trim().min(1).max(160), image: uploadedImageSchema }))
    .min(1)
    .max(MAX_PHOTO_BATCH),
});

/**
 * "Crear desde fotos": un ítem por foto ya subida (nombre y foto; el precio
 * y lo demás se completan después). Por defecto quedan ocultos, para que no
 * salgan al público a medias. Respeta el límite del plan.
 */
export async function createItemsFromPhotos(input: z.input<typeof photoBatchSchema>): Promise<ActionResult<{ created: number }>> {
  const ctx = await requireBusinessContext();
  const parsed = photoBatchSchema.safeParse(input);
  if (!parsed.success) return fail(msg('Revisa los nombres de los productos.'));
  const { type, categoryId, visible, items } = parsed.data;
  if (items.some(({ image }) => !isPathOwnedBy(image.path, ctx.business.id) || (image.thumbPath && !isPathOwnedBy(image.thumbPath, ctx.business.id)))) {
    return fail(msg('Una de las imágenes no es válida. Vuelve a subirla.'));
  }
  if (!(await categoryBelongsToCatalog(ctx, categoryId))) return fail(msg('La categoría ya no existe.'));

  const maxItems = ctx.entitlements.limits.max_items;
  const { count } = await ctx.supabase.from('catalog_items').select('id', { count: 'exact', head: true }).eq('business_id', ctx.business.id).is('deleted_at', null);
  if (maxItems !== null && !isWithinLimit(maxItems, (count ?? 0) + items.length - 1)) {
    const t = await getT();
    return fail(t('Tu plan permite hasta {max} ítems: tienes {current} y quieres agregar {count}.', { max: maxItems, current: count ?? 0, count: items.length }));
  }

  // URLs del catálogo, también las de ítems eliminados: así restaurar uno ("Deshacer") no choca.
  const existing = await fetchAllRows((from, to) => ctx.supabase.from('catalog_items').select('slug').eq('catalog_id', ctx.catalog.id).order('id').range(from, to));
  const used = new Set(existing.map((row) => row.slug));
  let position = await nextPosition(ctx);
  const rows = items.map(({ name }) => {
    let slug = slugify(name, 60) || 'item';
    while (used.has(slug)) slug = withRandomSuffix(slugify(name, 60) || 'item');
    used.add(slug);
    return { name, slug, type, category_id: categoryId, is_visible: visible, position: position++, currency: parseCatalogSettings(ctx.catalog.settings).currency, business_id: ctx.business.id, catalog_id: ctx.catalog.id };
  });
  const { data: created, error } = await ctx.supabase.from('catalog_items').insert(rows).select('id, slug');
  if (error) return fail(error.message.includes('plan_limit_reached') ? msg('Se alcanzó el límite de tu plan.') : dbErrorMessage(error));

  const idBySlug = new Map(created.map((row) => [row.slug, row.id]));
  const { error: imageError } = await ctx.supabase.from('catalog_item_images').insert(
    items.map(({ image }, index) => ({
      business_id: ctx.business.id,
      item_id: idBySlug.get(rows[index].slug)!,
      position: 0,
      alt: null,
      storage_path: image.path,
      thumb_path: image.thumbPath,
      width: image.width,
      height: image.height,
      size_bytes: image.sizeBytes,
      mime_type: image.mimeType,
    })),
  );
  if (imageError) return fail(dbErrorMessage(imageError, msg('No se pudo guardar una imagen.')));
  afterChange(ctx);
  const t = await getT();
  return ok({ created: created.length }, created.length === 1 ? t('Se creó 1 ítem') : t('Se crearon {count} ítems', { count: created.length }));
}
