import type { MetadataRoute } from 'next';
import { parseItemAttributes } from '@/lib/catalog/item-attributes';
import { inSeason } from '@/lib/catalog/season';
import { parseSeo } from '@/lib/catalog/settings';
import { catalogUrl, itemUrl } from '@/lib/catalog/view-model';

/**
 * Entradas del sitemap de los catálogos publicados: inicio, páginas y fichas.
 * Puro (los datos llegan ya leídos) para probarlo sin base. Se omite lo
 * marcado "no indexar" (todo el catálogo o una página) y lo oculto.
 */
export type SitemapData = {
  businesses: { id: string; slug: string }[];
  catalogs: { id: string; business_id: string; seo: unknown; updated_at: string }[];
  pages: { catalog_id: string; slug: string; is_home: boolean; seo: unknown; updated_at: string }[];
  items: { catalog_id: string; slug: string; updated_at: string; attributes?: unknown }[];
};

/** Límite del protocolo: 50 000 URLs por sitemap (se deja margen para las de la plataforma). */
export const MAX_SITEMAP_URLS = 45_000;

export function catalogSitemapEntries({ businesses, catalogs, pages, items }: SitemapData, max = MAX_SITEMAP_URLS, now = new Date()): MetadataRoute.Sitemap {
  const slugOf = new Map(businesses.map((b) => [b.id, b.slug]));
  const indexable = new Map(catalogs.flatMap((c) => (slugOf.has(c.business_id) && !parseSeo(c.seo).noindex ? [[c.id, slugOf.get(c.business_id)!]] : [])));
  const entries: MetadataRoute.Sitemap = [];
  const push = (entry: MetadataRoute.Sitemap[number]) => entries.length < max && entries.push(entry);

  for (const catalog of catalogs) {
    const slug = indexable.get(catalog.id);
    if (slug) push({ url: catalogUrl(slug), lastModified: catalog.updated_at, changeFrequency: 'weekly', priority: 0.8 });
  }
  for (const page of pages) {
    const slug = indexable.get(page.catalog_id);
    if (slug && !page.is_home && !parseSeo(page.seo).noindex) push({ url: `${catalogUrl(slug)}/${page.slug}`, lastModified: page.updated_at, changeFrequency: 'weekly', priority: 0.6 });
  }
  for (const item of items) {
    const slug = indexable.get(item.catalog_id);
    // Fuera de temporada la ficha no existe en el sitio.
    if (slug && inSeason(parseItemAttributes(item.attributes).season, now)) push({ url: itemUrl(slug, item.slug), lastModified: item.updated_at, changeFrequency: 'weekly', priority: 0.5 });
  }
  return entries;
}
