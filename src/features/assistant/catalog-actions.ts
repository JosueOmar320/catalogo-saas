'use server';

import { canManageCatalog, requireBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { isCatalogAction, parseActions, type CatalogAction } from '@/lib/assistant/actions';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { isPathOwnedBy } from '@/lib/utils/storage';
import { getItem } from '@/features/catalog/queries';
import { reorder } from '@/features/catalog/reorder-actions';
import { createCategory, deleteCategory, updateCategory } from '@/features/categories/actions';
import { setBusinessLogo } from '@/features/business/actions';
import { deleteItem, saveItem } from '@/features/items/actions';
import { emptyItemValues, itemToFormValues } from '@/features/items/defaults';
import type { ItemFormValues } from '@/features/items/schema';

/**
 * Aplica las acciones de CATÁLOGO que propuso Garfield (productos y
 * categorías) cuando el usuario pulsa "Aplicar". No duplica lógica: llama a
 * las mismas Server Actions que usan los formularios (validación Zod, límites
 * del plan, RLS, caché del sitio público). Devuelve los ids de lo creado para
 * resolver los $alias de las acciones del editor.
 */

export type CatalogStepResult = { label: string; ok: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const priceText = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Math.round(v * 100) / 100));

export async function applyCatalogActions(raw: unknown[]): Promise<ActionResult<{ results: CatalogStepResult[]; aliases: Record<string, string> }>> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail('Sólo el dueño o un administrador puede cambiar el catálogo.');
  const { actions } = parseActions(raw);
  const catalogActions = actions.filter(isCatalogAction);
  if (catalogActions.length === 0) return ok({ results: [], aliases: {} });

  // Por páginas: con más de 1000 productos la lista se cortaría y "el producto X" no se encontraría.
  const [categories, items] = await Promise.all([
    fetchAllRows((from, to) => ctx.supabase.from('categories').select('id, name').eq('catalog_id', ctx.catalog.id).is('deleted_at', null).order('id').range(from, to)),
    fetchAllRows((from, to) => ctx.supabase.from('catalog_items').select('id, name').eq('catalog_id', ctx.catalog.id).is('deleted_at', null).order('id').range(from, to)),
  ]);
  const categoryList = [...categories];
  const itemList = [...items];
  const aliases: Record<string, string> = {};
  const currency = parseCatalogSettings(ctx.catalog.settings).currency;

  const resolve = (list: { id: string; name: string }[], ref: string, what: string): string => {
    if (ref.startsWith('$')) {
      if (aliases[ref]) return aliases[ref];
      throw new Error(`No encuentro ${what} ${ref} (¿falló el paso que la creaba?).`);
    }
    if (UUID.test(ref) && list.some((x) => x.id === ref)) return ref;
    const key = norm(ref);
    const found = list.find((x) => norm(x.name) === key) ?? list.find((x) => norm(x.name).includes(key));
    if (!found) throw new Error(`No encuentro ${what} "${ref}".`);
    return found.id;
  };

  const results: CatalogStepResult[] = [];
  for (const action of catalogActions) {
    try {
      const outcome = await applyOne(ctx, action, { resolve, categoryList, itemList, aliases, currency });
      results.push({ label: outcome, ok: true });
    } catch (error) {
      results.push({ label: action.action.replace(/_/g, ' '), ok: false, error: (error as Error).message });
    }
  }
  return ok({ results, aliases }, results.every((r) => r.ok) ? 'Catálogo actualizado' : undefined);
}

type Helpers = {
  resolve: (list: { id: string; name: string }[], ref: string, what: string) => string;
  categoryList: { id: string; name: string }[];
  itemList: { id: string; name: string }[];
  aliases: Record<string, string>;
  currency: ItemFormValues['currency'];
};

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Imagen de la biblioteca para un producto o categoría (debe ser un archivo propio, no un enlace externo). */
async function imageFor(ctx: BusinessContext, path: string): Promise<{ path: string; thumbPath: string | null; width: number | null; height: number | null; mime: string | null; size: number | null; alt: string }> {
  if (!isPathOwnedBy(path, ctx.business.id)) throw new Error('Una de las imágenes no pertenece al negocio.');
  const { data: asset } = await ctx.supabase.from('media_assets').select('path, thumb_path, width, height, mime_type, size_bytes, alt').eq('business_id', ctx.business.id).eq('path', path).is('deleted_at', null).maybeSingle();
  if (!asset) throw new Error('Una de las imágenes no está en la biblioteca.');
  // Cualquier imagen propia sirve para cualquier uso: se reutiliza el MISMO archivo (sin copias).
  return { path, thumbPath: asset.thumb_path && asset.thumb_path !== path ? asset.thumb_path : null, width: asset.width, height: asset.height, mime: asset.mime_type, size: asset.size_bytes, alt: asset.alt };
}

async function productImages(ctx: BusinessContext, paths: string[]): Promise<ItemFormValues['images']> {
  const images: ItemFormValues['images'] = [];
  for (const path of paths) {
    const image = await imageFor(ctx, path);
    const mime = image.mime === 'image/png' || image.mime === 'image/webp' || image.mime === 'image/jpeg' ? image.mime : null;
    images.push({ path: image.path, thumbPath: image.thumbPath, width: image.width, height: image.height, sizeBytes: image.size, mimeType: mime, alt: image.alt });
  }
  return images;
}

async function applyOne(ctx: BusinessContext, action: CatalogAction, h: Helpers): Promise<string> {
  switch (action.action) {
    case 'set_logo': {
      if (!action.path) throw new Error('No encontré un logo en tu biblioteca. Súbelo en Medios (carpeta Logos).');
      if (!isPathOwnedBy(action.path, ctx.business.id)) throw new Error('El logo debe estar en tu biblioteca: importa la imagen primero.');
      unwrap(await setBusinessLogo(action.path));
      return 'Logo del negocio actualizado';
    }
    case 'create_category': {
      const imagePath = action.imagePath ? (await imageFor(ctx, action.imagePath)).path : null;
      const { id } = unwrap(await createCategory({ name: action.name, description: action.description ?? '', imagePath, isActive: true }));
      h.categoryList.push({ id, name: action.name });
      if (action.as) h.aliases[action.as] = id;
      return `Categoría «${action.name}» creada`;
    }
    case 'update_category': {
      const id = h.resolve(h.categoryList, action.category, 'la categoría');
      const { data: current } = await ctx.supabase.from('categories').select('name, description, image_path, is_active').eq('id', id).single();
      if (!current) throw new Error('La categoría ya no existe.');
      const imagePath = action.imagePath === undefined ? current.image_path : action.imagePath === null ? null : (await imageFor(ctx, action.imagePath)).path;
      unwrap(await updateCategory(id, { name: action.name ?? current.name, description: action.description ?? current.description ?? '', imagePath, isActive: action.active ?? current.is_active }));
      return `Categoría «${action.name ?? current.name}» actualizada`;
    }
    case 'delete_category': {
      const id = h.resolve(h.categoryList, action.category, 'la categoría');
      unwrap(await deleteCategory(id));
      return `Categoría «${action.category}» eliminada`;
    }
    case 'reorder_categories': {
      const ids = action.order.map((ref) => h.resolve(h.categoryList, ref, 'la categoría'));
      unwrap(await reorder({ table: 'categories', ids: [...ids, ...h.categoryList.map((c) => c.id).filter((id) => !ids.includes(id))] }));
      return 'Categorías reordenadas';
    }
    case 'create_product': {
      const values: ItemFormValues = {
        ...emptyItemValues(action.type ?? 'product', h.currency),
        name: action.name,
        categoryId: action.category ? h.resolve(h.categoryList, action.category, 'la categoría') : '',
        price: priceText(action.price),
        compareAtPrice: priceText(action.compareAtPrice),
        priceNote: action.priceNote ?? '',
        shortDescription: action.shortDescription ?? '',
        description: action.description ?? '',
        sku: action.sku ?? '',
        isFeatured: action.featured ?? false,
        isAvailable: action.available ?? true,
        isVisible: action.visible ?? true,
        badges: action.badges ?? [],
        tags: action.tags ?? [],
        images: action.imagePaths ? await productImages(ctx, action.imagePaths) : [],
      };
      const { id } = unwrap(await saveItem(null, values));
      h.itemList.push({ id, name: action.name });
      if (action.as) h.aliases[action.as] = id;
      return `${action.type === 'service' ? 'Servicio' : 'Producto'} «${action.name}» creado`;
    }
    case 'update_product': {
      const id = h.resolve(h.itemList, action.product, 'el producto');
      const item = await getItem(ctx, id);
      if (!item) throw new Error('El producto ya no existe.');
      const current = itemToFormValues(item);
      const values: ItemFormValues = {
        ...current,
        ...(action.name !== undefined ? { name: action.name } : {}),
        ...(action.category !== undefined ? { categoryId: action.category === null ? '' : h.resolve(h.categoryList, action.category, 'la categoría') } : {}),
        ...(action.price !== undefined ? { price: priceText(action.price) } : {}),
        ...(action.compareAtPrice !== undefined ? { compareAtPrice: priceText(action.compareAtPrice) } : {}),
        ...(action.priceNote !== undefined ? { priceNote: action.priceNote } : {}),
        ...(action.shortDescription !== undefined ? { shortDescription: action.shortDescription } : {}),
        ...(action.description !== undefined ? { description: action.description } : {}),
        ...(action.sku !== undefined ? { sku: action.sku } : {}),
        ...(action.featured !== undefined ? { isFeatured: action.featured } : {}),
        ...(action.available !== undefined ? { isAvailable: action.available } : {}),
        ...(action.visible !== undefined ? { isVisible: action.visible } : {}),
        ...(action.badges !== undefined ? { badges: action.badges } : {}),
        ...(action.tags !== undefined ? { tags: action.tags } : {}),
        ...(action.imagePaths !== undefined ? { images: await productImages(ctx, action.imagePaths) } : {}),
      };
      unwrap(await saveItem(id, values));
      return `«${values.name}» actualizado`;
    }
    case 'delete_product': {
      const id = h.resolve(h.itemList, action.product, 'el producto');
      unwrap(await deleteItem(id));
      return `«${action.product}» eliminado`;
    }
    case 'reorder_products': {
      const ids = action.order.map((ref) => h.resolve(h.itemList, ref, 'el producto'));
      unwrap(await reorder({ table: 'catalog_items', ids: [...ids, ...h.itemList.map((i) => i.id).filter((id) => !ids.includes(id))] }));
      return 'Productos reordenados';
    }
  }
}

