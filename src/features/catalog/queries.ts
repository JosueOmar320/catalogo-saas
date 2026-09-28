import 'server-only';
import { cache } from 'react';
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

/** Ítems con sus imágenes (una sola consulta extra para todas las imágenes). */
export const listItemsWithImages = cache(async (ctx: BusinessContext) => {
  const { data: items, error } = await ctx.supabase
    .from('catalog_items')
    .select(ITEM_COLUMNS)
    .eq('catalog_id', ctx.catalog.id)
    .is('deleted_at', null)
    .order('position')
    .order('created_at');
  if (error) throw error;

  const ids = items.map((i) => i.id);
  const { data: images, error: imagesError } = ids.length
    ? await ctx.supabase.from('catalog_item_images').select('*').in('item_id', ids).order('position')
    : { data: [], error: null };
  if (imagesError) throw imagesError;

  const byItem = new Map<string, typeof images>();
  for (const image of images ?? []) {
    byItem.set(image.item_id, [...(byItem.get(image.item_id) ?? []), image]);
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
