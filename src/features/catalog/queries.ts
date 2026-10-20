import 'server-only';
import { cache } from 'react';
import { fetchAllRows } from '@/lib/supabase/paginate';
import type { BusinessContext } from '@/lib/auth/session';
import { pageFromRow, type SitePage } from '@/lib/site/pages';
import { buildSiteViewModel, type SiteViewModel } from '@/lib/site/view-model';
import { publicStorageUrl } from '@/lib/utils/storage';

const ITEM_COLUMNS =
  'id, category_id, type, name, slug, short_description, description, price, compare_at_price, currency, price_note, sku, is_available, is_featured, is_visible, position, tags, attributes, created_at, updated_at, deleted_at';

/** Categorías del catálogo activo (panel). */
export const listCategories = cache(async (ctx: BusinessContext) => {
  const { data, error } = await ctx.supabase
    .from('categories')
    .select('*')
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .order('position')
    .order('created_at');
  if (error) throw error;
  return data;
});

/**
 * Ítems con sus imágenes. Las imágenes se piden por NEGOCIO (índice
 * catalog_item_images_business_idx) y no con `in(item_id, …)`: con cientos de
 * ítems esa lista de ids no cabe en la URL (desde ~450 ítems la petición
 * falla). Ambas lecturas van por páginas (límite de 1000 filas de Supabase).
 */
export const listItemsWithImages = cache(async (ctx: BusinessContext) => {
  const [items, images] = await Promise.all([
    fetchAllRows((from, to) =>
      ctx.supabase.from('catalog_items').select(ITEM_COLUMNS).eq('catalog_id', ctx.catalog.id).is('deleted_at', null).order('position').order('created_at').order('id').range(from, to),
    ),
    fetchAllRows((from, to) => ctx.supabase.from('catalog_item_images').select('*').eq('business_id', ctx.business.id).order('item_id').order('position').order('id').range(from, to)),
  ]);

  const byItem = new Map<string, typeof images>();
  for (const image of images) {
    const list = byItem.get(image.item_id);
    if (list) list.push(image);
    else byItem.set(image.item_id, [image]);
  }
  return items.map((item) => ({ ...item, images: byItem.get(item.id) ?? [] }));
});

export type AdminItem = Awaited<ReturnType<typeof listItemsWithImages>>[number];

export function itemThumbnail(item: AdminItem): string | null {
  const first = item.images[0];
  return first ? publicStorageUrl(first.thumb_path ?? first.storage_path) : null;
}

export async function getItem(ctx: BusinessContext, itemId: string) {
  const { data: item } = await ctx.supabase
    .from('catalog_items')
    .select('*')
    .eq('id', itemId)
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!item) return null;
  const { data: images } = await ctx.supabase
    .from('catalog_item_images')
    .select('*')
    .eq('item_id', item.id)
    .order('position');
  return { ...item, images: images ?? [] };
}

/** Costo privado de un producto (null si no tiene o si aún no se puede leer). */
export async function getItemCost(ctx: BusinessContext, itemId: string): Promise<number | null> {
  const { data, error } = await ctx.supabase.from('item_costs').select('cost').eq('item_id', itemId).eq('business_id', ctx.business.id).maybeSingle();
  return error || !data ? null : Number(data.cost);
}

/** Costos privados de los productos del negocio (por id); vacío si aún no se pueden leer. */
export async function listItemCosts(ctx: BusinessContext): Promise<Map<string, number>> {
  const { data, error } = await ctx.supabase.from('item_costs').select('item_id, cost').eq('business_id', ctx.business.id).limit(10000);
  return new Map(error ? [] : data.map((row) => [row.item_id, Number(row.cost)]));
}

/**
 * Sitio con los datos actuales (lo que se publicaría al guardar): todas las
 * páginas (también ocultas, para la preview) e ítems visibles.
 */
export async function getSiteForAdmin(ctx: BusinessContext): Promise<SiteViewModel> {
  const [pages, categories, items] = await Promise.all([listPages(ctx), listCategories(ctx), listItemsWithImages(ctx)]);
  const activeCategories = categories.filter((c) => c.is_active);
  const activeIds = new Set(activeCategories.map((c) => c.id));
  const site = buildSiteViewModel({
    business: ctx.business,
    catalog: ctx.catalog,
    categories: activeCategories,
    items: items.filter((i) => i.is_visible && (i.category_id === null || activeIds.has(i.category_id))),
    pages: [],
    removeBranding: ctx.entitlements.features.remove_branding,
    customCode: ctx.customCode,
  });
  return { ...site, pages };
}

export const listPages = cache(async (ctx: BusinessContext): Promise<SitePage[]> => {
  const { data, error } = await ctx.supabase
    .from('catalog_pages')
    .select('*')
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .order('position')
    .order('created_at');
  if (error) throw error;
  return data.map(pageFromRow);
});
