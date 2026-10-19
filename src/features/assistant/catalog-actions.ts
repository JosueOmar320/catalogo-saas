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
import { foldText } from '@/lib/utils/text';
import { getT } from '@/i18n/server';
import type { Translator } from '@/i18n/translate';

/**
 * Aplica las acciones de CATÁLOGO que propuso Garfield (productos y
 * categorías) cuando el usuario pulsa "Aplicar". No duplica lógica: llama a
 * las mismas Server Actions que usan los formularios (validación Zod, límites
 * del plan, RLS, caché del sitio público). Devuelve los ids de lo creado para
 * resolver los $alias de las acciones del editor.
 */

export type CatalogStepResult = { label: string; ok: boolean; error?: string };
type RefKind = 'category' | 'product';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const norm = (v: string) => foldText(v).trim();
const priceText = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Math.round(v * 100) / 100));

export async function applyCatalogActions(raw: unknown[]): Promise<ActionResult<{ results: CatalogStepResult[]; aliases: Record<string, string> }>> {
  const ctx = await requireBusinessContext();
  // Etiquetas y errores ya traducidos al idioma del usuario (se muestran tal cual en el chat).
  const t = await getT();
  if (!canManageCatalog(ctx)) return fail(t('Sólo el dueño o un administrador puede cambiar el catálogo.'));
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

  const resolve = (list: { id: string; name: string }[], ref: string, kind: RefKind): string => {
    if (ref.startsWith('$')) {
      if (aliases[ref]) return aliases[ref];
      throw new Error(kind === 'category' ? t('No encuentro la categoría {ref} (¿falló el paso que la creaba?).', { ref }) : t('No encuentro el producto {ref} (¿falló el paso que lo creaba?).', { ref }));
    }
    if (UUID.test(ref) && list.some((x) => x.id === ref)) return ref;
    const key = norm(ref);
    const exact = list.find((x) => norm(x.name) === key);
    if (exact) return exact.id;
    // Coincidencia parcial sólo si es única: "Té" no debe elegir al azar entre "Té verde" y "Té negro"
    // (estas acciones también borran y editan).
    const partial = key ? list.filter((x) => norm(x.name).includes(key)) : [];
    if (partial.length === 1) return partial[0].id;
    if (partial.length > 1) throw new Error(t('Hay varios con "{ref}" ({options}). Dime el nombre completo.', { ref, options: partial.slice(0, 4).map((x) => `"${x.name}"`).join(', ') }));
    throw new Error(kind === 'category' ? t('No encuentro la categoría "{ref}".', { ref }) : t('No encuentro el producto "{ref}".', { ref }));
  };

  const results: CatalogStepResult[] = [];
  for (const action of catalogActions) {
    try {
      const outcome = await applyOne(ctx, action, { resolve, categoryList, itemList, aliases, currency, t });
      results.push({ label: outcome, ok: true });
    } catch (error) {
      // Los errores de las Server Actions llegan en español (clave del catálogo): se traducen aquí.
      results.push({ label: action.action.replace(/_/g, ' '), ok: false, error: t((error as Error).message) });
    }
  }
  return ok({ results, aliases }, results.every((r) => r.ok) ? t('Catálogo actualizado') : undefined);
}

type Helpers = {
  resolve: (list: { id: string; name: string }[], ref: string, kind: RefKind) => string;
  categoryList: { id: string; name: string }[];
  itemList: { id: string; name: string }[];
  aliases: Record<string, string>;
  currency: ItemFormValues['currency'];
  t: Translator;
};

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Imagen de la biblioteca para un producto o categoría (debe ser un archivo propio, no un enlace externo). */
async function imageFor(ctx: BusinessContext, path: string, t: Translator): Promise<{ path: string; thumbPath: string | null; width: number | null; height: number | null; mime: string | null; size: number | null; alt: string }> {
  if (!isPathOwnedBy(path, ctx.business.id)) throw new Error(t('Una de las imágenes no pertenece al negocio.'));
  const { data: asset } = await ctx.supabase.from('media_assets').select('path, thumb_path, width, height, mime_type, size_bytes, alt').eq('business_id', ctx.business.id).eq('path', path).is('deleted_at', null).maybeSingle();
  if (!asset) throw new Error(t('Una de las imágenes no está en la biblioteca.'));
  // Cualquier imagen propia sirve para cualquier uso: se reutiliza el MISMO archivo (sin copias).
  return { path, thumbPath: asset.thumb_path && asset.thumb_path !== path ? asset.thumb_path : null, width: asset.width, height: asset.height, mime: asset.mime_type, size: asset.size_bytes, alt: asset.alt };
}

async function productImages(ctx: BusinessContext, paths: string[], t: Translator): Promise<ItemFormValues['images']> {
  const images: ItemFormValues['images'] = [];
  for (const path of paths) {
    const image = await imageFor(ctx, path, t);
    const mime = image.mime === 'image/png' || image.mime === 'image/webp' || image.mime === 'image/jpeg' ? image.mime : null;
    images.push({ path: image.path, thumbPath: image.thumbPath, width: image.width, height: image.height, sizeBytes: image.size, mimeType: mime, alt: image.alt });
  }
  return images;
}

async function applyOne(ctx: BusinessContext, action: CatalogAction, h: Helpers): Promise<string> {
  const { t } = h;
  switch (action.action) {
    case 'set_logo': {
      if (!action.path) throw new Error(t('No encontré un logo en tu biblioteca. Súbelo en Medios (carpeta Logos).'));
      if (!isPathOwnedBy(action.path, ctx.business.id)) throw new Error(t('El logo debe estar en tu biblioteca: importa la imagen primero.'));
      unwrap(await setBusinessLogo(action.path));
      return t('Logo del negocio actualizado');
    }
    case 'create_category': {
      const imagePath = action.imagePath ? (await imageFor(ctx, action.imagePath, t)).path : null;
      const { id } = unwrap(await createCategory({ name: action.name, description: action.description ?? '', imagePath, isActive: true }));
      h.categoryList.push({ id, name: action.name });
      if (action.as) h.aliases[action.as] = id;
      return t('Categoría «{name}» creada', { name: action.name });
    }
    case 'update_category': {
      const id = h.resolve(h.categoryList, action.category, 'category');
      const { data: current } = await ctx.supabase.from('categories').select('name, description, image_path, is_active').eq('id', id).single();
      if (!current) throw new Error(t('La categoría ya no existe.'));
      const imagePath = action.imagePath === undefined ? current.image_path : action.imagePath === null ? null : (await imageFor(ctx, action.imagePath, t)).path;
      unwrap(await updateCategory(id, { name: action.name ?? current.name, description: action.description ?? current.description ?? '', imagePath, isActive: action.active ?? current.is_active }));
      return t('Categoría «{name}» actualizada', { name: action.name ?? current.name });
    }
    case 'delete_category': {
      const id = h.resolve(h.categoryList, action.category, 'category');
      unwrap(await deleteCategory(id));
      return t('Categoría «{name}» eliminada', { name: action.category });
    }
    case 'reorder_categories': {
      const ids = action.order.map((ref) => h.resolve(h.categoryList, ref, 'category'));
      unwrap(await reorder({ table: 'categories', ids: [...ids, ...h.categoryList.map((c) => c.id).filter((id) => !ids.includes(id))] }));
      return t('Categorías reordenadas');
    }
    case 'create_product': {
      const values: ItemFormValues = {
        ...emptyItemValues(action.type ?? 'product', h.currency),
        name: action.name,
        categoryId: action.category ? h.resolve(h.categoryList, action.category, 'category') : '',
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
        images: action.imagePaths ? await productImages(ctx, action.imagePaths, t) : [],
      };
      const { id } = unwrap(await saveItem(null, values));
      h.itemList.push({ id, name: action.name });
      if (action.as) h.aliases[action.as] = id;
      return action.type === 'service' ? t('Servicio «{name}» creado', { name: action.name }) : t('Producto «{name}» creado', { name: action.name });
    }
    case 'update_product': {
      const id = h.resolve(h.itemList, action.product, 'product');
      const item = await getItem(ctx, id);
      if (!item) throw new Error(t('El producto ya no existe.'));
      const current = itemToFormValues(item);
      const values: ItemFormValues = {
        ...current,
        ...(action.name !== undefined ? { name: action.name } : {}),
        ...(action.category !== undefined ? { categoryId: action.category === null ? '' : h.resolve(h.categoryList, action.category, 'category') } : {}),
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
        ...(action.imagePaths !== undefined ? { images: await productImages(ctx, action.imagePaths, t) } : {}),
      };
      unwrap(await saveItem(id, values));
      return t('«{name}» actualizado', { name: values.name });
    }
    case 'delete_product': {
      const id = h.resolve(h.itemList, action.product, 'product');
      unwrap(await deleteItem(id));
      return t('«{name}» eliminado', { name: action.product });
    }
    case 'reorder_products': {
      const ids = action.order.map((ref) => h.resolve(h.itemList, ref, 'product'));
      unwrap(await reorder({ table: 'catalog_items', ids: [...ids, ...h.itemList.map((i) => i.id).filter((id) => !ids.includes(id))] }));
      return t('Productos reordenados');
    }
  }
}

