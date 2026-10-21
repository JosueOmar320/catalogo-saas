import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { parseSiteKind } from '@/lib/business/site-kind';
import { publicCatalogTag } from '@/lib/catalog/cache';
import type { ItemInput } from '@/lib/catalog/view-model';
import { isSupabaseConfigured } from '@/lib/env';
import { toPublicReview, type PublicReview } from '@/lib/catalog/reviews';
import { buildSiteViewModel, type SiteViewModel } from '@/lib/site/view-model';
import { createPublicClient } from '@/lib/supabase/public';
import type { Tables } from '@/types/database';

type PublicCatalogPayload = {
  business: Pick<Tables<'businesses'>, 'id' | 'name' | 'slug' | 'description' | 'slogan' | 'logo_path' | 'contact' | 'social_links'> & {
    remove_branding: boolean;
    custom_code: boolean;
    /** Tipo de sitio (migración site_kind); ausente = negocio con catálogo. */
    site_kind?: string;
  };
  catalog: Tables<'catalogs'>;
  categories: Tables<'categories'>[];
  items: (Tables<'catalog_items'> & { images: Tables<'catalog_item_images'>[] })[];
  /** Sólo las páginas publicadas (puede ser vacío si el dueño las ocultó todas). */
  pages: Tables<'catalog_pages'>[];
};

/** Reseñas aprobadas. Un error se lanza (no se cachea como "sin reseñas"). */
async function fetchPublicReviews(slug: string): Promise<PublicReview[]> {
  const { data, error } = await createPublicClient().rpc('get_public_reviews', { p_business_slug: slug });
  if (error) throw Object.assign(new Error(`get_public_reviews: ${error.message}`), { code: error.code });
  return (data ?? []).map(toPublicReview);
}

/** Si la RPC falla, este render sale sin reseñas; el siguiente vuelve a intentarlo (la caché no guarda el fallo). */
async function getPublicReviews(slug: string): Promise<PublicReview[]> {
  try {
    return await unstable_cache(fetchPublicReviews, ['public-reviews', slug], { tags: [publicCatalogTag(slug)], revalidate: 3600 })(slug);
  } catch (error) {
    console.error('[public-reviews]', { code: (error as { code?: string }).code ?? null });
    return [];
  }
}

async function fetchPublicCatalog(slug: string): Promise<PublicCatalogPayload | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('get_public_catalog', { p_business_slug: slug });
  if (error) throw new Error(`get_public_catalog: ${error.message}`);
  return (data as PublicCatalogPayload | null) ?? null;
}

/**
 * Sitio público completo (páginas publicadas, navegación, ítems): 1 llamada
 * RPC, cacheada entre requests y deduplicada dentro del mismo render
 * (layout + page + generateMetadata). Sin páginas publicadas, `pages` queda
 * vacío y la página pública responde 404 (el layout tolera la lista vacía).
 */
export const getPublicSite = cache(async (slug: string): Promise<SiteViewModel | null> => {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,48}$/.test(slug)) return null;

  const [payload, reviews] = await Promise.all([
    unstable_cache(fetchPublicCatalog, ['public-catalog-v2', slug], { tags: [publicCatalogTag(slug)], revalidate: 3600 })(slug),
    getPublicReviews(slug),
  ]);
  if (!payload) return null;

  const site = buildSiteViewModel({
    business: payload.business,
    catalog: payload.catalog,
    categories: payload.categories,
    items: payload.items as ItemInput[],
    pages: payload.pages,
    removeBranding: payload.business.remove_branding,
    customCode: payload.business.custom_code === true,
    siteKind: parseSiteKind(payload.business.site_kind),
  }, { public: true });
  site.reviews = site.settings.reviews.enabled ? reviews : [];
  return site;
});
