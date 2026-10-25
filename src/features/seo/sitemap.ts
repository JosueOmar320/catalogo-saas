import 'server-only';
import type { MetadataRoute } from 'next';
import { catalogSitemapEntries, type SitemapData } from '@/lib/catalog/sitemap';
import { activeDomain } from '@/lib/catalog/view-model';
import { isSupabaseConfigured } from '@/lib/env';
import { parseEntitlements } from '@/lib/plans/entitlements';
import { effectiveFeatures, parseFeatureOverrides } from '@/lib/plans/features';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/paginate';

const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * Lee lo público de todos los catálogos publicados (con la service role, sólo
 * en el servidor: slugs y fechas, nada privado) y arma el sitemap. Sin base
 * configurada, o si falla, devuelve [] y el sitemap queda con la plataforma.
 */
/** businessSlug: sólo ese negocio (el sitemap de su dominio propio). */
export async function publishedCatalogsSitemap({ businessSlug }: { businessSlug?: string } = {}): Promise<MetadataRoute.Sitemap> {
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return [];
  try {
    const db = createAdminClient();
    // «*»: el dominio propio llega con su migración; antes, las columnas no existen y se ignoran.
    const rows = await fetchAllRows((from, to) => {
      const query = db.from('businesses').select('*').eq('status', 'active').is('deleted_at', null);
      return (businessSlug ? query.eq('slug', businessSlug) : query).order('id').range(from, to);
    });
    // El dominio propio sólo cuenta con la función encendida (decisión del administrador o plan), como en get_site_by_domain.
    const { data: plans } = await db.from('plans').select('*');
    const planFeatures = new Map((plans ?? []).map((p) => [p.id, parseEntitlements(p).features]));
    const domainOf = (b: (typeof rows)[number]) => {
      const plan = planFeatures.get(b.plan_id);
      return plan && effectiveFeatures(parseFeatureOverrides(b.feature_overrides), plan).custom_domain ? activeDomain(b) : null;
    };
    const businesses = rows.map((b) => ({ id: b.id, slug: b.slug, domain: domainOf(b) }));
    const active = new Set(businesses.map((b) => b.id));
    const catalogs = (
      await fetchAllRows((from, to) =>
        db.from('catalogs').select('id, business_id, seo, updated_at').eq('status', 'published').eq('is_default', true).eq('is_active', true).is('deleted_at', null).order('id').range(from, to),
      )
    ).filter((c) => active.has(c.business_id));
    const data: SitemapData = { businesses, catalogs, pages: [], items: [], categories: [] };
    for (const ids of chunk(catalogs.map((c) => c.id), 100)) {
      const [pages, items, categories] = await Promise.all([
        fetchAllRows((from, to) => db.from('catalog_pages').select('catalog_id, slug, is_home, seo, updated_at').in('catalog_id', ids).eq('is_published', true).is('deleted_at', null).order('id').range(from, to)),
        fetchAllRows((from, to) => db.from('catalog_items').select('catalog_id, slug, updated_at, attributes, category_id').in('catalog_id', ids).eq('is_visible', true).is('deleted_at', null).order('id').range(from, to)),
        // Todas (también ocultas y borradas): sus ítems no tienen ficha en el sitio.
        fetchAllRows((from, to) => db.from('categories').select('id, is_active, deleted_at').in('catalog_id', ids).order('id').range(from, to)),
      ]);
      data.pages.push(...pages);
      data.items.push(...items);
      data.categories!.push(...categories);
    }
    return catalogSitemapEntries(data);
  } catch (error) {
    console.error('[sitemap] no se pudieron leer los catálogos', error instanceof Error ? error.message : error);
    return [];
  }
}
