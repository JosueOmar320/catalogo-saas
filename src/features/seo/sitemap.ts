import 'server-only';
import type { MetadataRoute } from 'next';
import { catalogSitemapEntries, type SitemapData } from '@/lib/catalog/sitemap';
import { isSupabaseConfigured } from '@/lib/env';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/paginate';

const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * Lee lo público de todos los catálogos publicados (con la service role, sólo
 * en el servidor: slugs y fechas, nada privado) y arma el sitemap. Sin base
 * configurada, o si falla, devuelve [] y el sitemap queda con la plataforma.
 */
export async function publishedCatalogsSitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return [];
  try {
    const db = createAdminClient();
    const businesses = await fetchAllRows((from, to) => db.from('businesses').select('id, slug').eq('status', 'active').is('deleted_at', null).order('id').range(from, to));
    const active = new Set(businesses.map((b) => b.id));
    const catalogs = (
      await fetchAllRows((from, to) =>
        db.from('catalogs').select('id, business_id, seo, updated_at').eq('status', 'published').eq('is_default', true).eq('is_active', true).is('deleted_at', null).order('id').range(from, to),
      )
    ).filter((c) => active.has(c.business_id));
    const data: SitemapData = { businesses, catalogs, pages: [], items: [] };
    for (const ids of chunk(catalogs.map((c) => c.id), 100)) {
      const [pages, items] = await Promise.all([
        fetchAllRows((from, to) => db.from('catalog_pages').select('catalog_id, slug, is_home, seo, updated_at').in('catalog_id', ids).eq('is_published', true).is('deleted_at', null).order('id').range(from, to)),
        fetchAllRows((from, to) => db.from('catalog_items').select('catalog_id, slug, updated_at, attributes').in('catalog_id', ids).eq('is_visible', true).is('deleted_at', null).order('id').range(from, to)),
      ]);
      data.pages.push(...pages);
      data.items.push(...items);
    }
    return catalogSitemapEntries(data);
  } catch (error) {
    console.error('[sitemap] no se pudieron leer los catálogos', error instanceof Error ? error.message : error);
    return [];
  }
}
