import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { publicCatalogTag } from '@/lib/catalog/cache';
import type { ItemInput } from '@/lib/catalog/view-model';
import { isSupabaseConfigured } from '@/lib/env';
import { navigationFromPages } from '@/lib/site/navigation';
import { buildFallbackHome } from '@/lib/site/starter';
import { toPublicReview, type PublicReview } from '@/lib/catalog/reviews';
import { buildSiteViewModel, type SiteViewModel } from '@/lib/site/view-model';
import { createPublicClient } from '@/lib/supabase/public';
import type { Tables } from '@/types/database';

type PublicCatalogPayload = {
  business: Pick<Tables<'businesses'>, 'id' | 'name' | 'slug' | 'description' | 'slogan' | 'logo_path' | 'contact' | 'social_links'> & {
    remove_branding: boolean;
    /** Ausente antes de la migración custom_code: apagado. */
    custom_code?: boolean;
  };
  catalog: Tables<'catalogs'>;
  categories: Tables<'categories'>[];
  items: (Tables<'catalog_items'> & { images: Tables<'catalog_item_images'>[] })[];
  pages?: Tables<'catalog_pages'>[];
};

/** Reseñas aprobadas. Si la migración aún no está, o falla, el sitio sigue sin ellas. */
async function fetchPublicReviews(slug: string): Promise<PublicReview[]> {
  const { data, error } = await createPublicClient().rpc('get_public_reviews', { p_business_slug: slug });
  if (error) return [];
  return (data ?? []).map(toPublicReview);
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
 * (layout + page + generateMetadata).
 */
export const getPublicSite = cache(async (slug: string): Promise<SiteViewModel | null> => {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{3,48}$/.test(slug)) return null;

  const [payload, reviews] = await Promise.all([
    unstable_cache(fetchPublicCatalog, ['public-catalog-v2', slug], { tags: [publicCatalogTag(slug)], revalidate: 3600 })(slug),
    unstable_cache(fetchPublicReviews, ['public-reviews', slug], { tags: [publicCatalogTag(slug)], revalidate: 3600 })(slug),
  ]);
  if (!payload) return null;

  const site = buildSiteViewModel({
    business: payload.business,
    catalog: payload.catalog,
    categories: payload.categories,
    items: payload.items as ItemInput[],
    pages: payload.pages ?? [],
    removeBranding: payload.business.remove_branding,
    customCode: payload.business.custom_code === true,
  }, { public: true });
  site.reviews = site.settings.reviews.enabled ? reviews : [];
  if (site.pages.length > 0) return site;
  // Sin páginas (p. ej. antes de aplicar la migración v2): mismo sitio que en la v1.
  const home = buildFallbackHome(Boolean(payload.catalog.cover_path), payload.catalog.cover_path);
  return { ...site, pages: [home], navigation: site.navigation.items.length ? site.navigation : navigationFromPages([home]) };
});
