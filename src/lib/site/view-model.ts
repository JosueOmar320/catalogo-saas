import { parseContact, parseSocialLinks, type BusinessContact, type SocialLink } from '@/lib/business/profile';
import { parseAttributeDefs, type AttributeDef } from '@/lib/catalog/attributes';
import { parseCatalogSettings, parseSeo, type CatalogSeo, type CatalogSettings } from '@/lib/catalog/settings';
import { catalogUrl, mapCategories, mapItems, type CatalogCategoryView, type CatalogItemView, type CategoryInput, type ItemInput } from '@/lib/catalog/view-model';
import { parseTheme, type ThemeConfig } from '@/lib/design/theme';
import { publicStorageUrl } from '@/lib/utils/storage';
import type { PublicReview } from '@/lib/catalog/reviews';
import type { Tables } from '@/types/database';
import { parseNavigation, type NavigationConfig } from './navigation';
import { pageFromRow, type SitePage } from './pages';

/**
 * Modelo único del sitio. Lo consumen: el sitio público, la preview del
 * builder, la demo y el PDF. Serializable (se pasa a Client Components).
 */
export type SiteViewModel = {
  business: {
    name: string;
    slug: string;
    description: string | null;
    slogan: string | null;
    logoUrl: string | null;
    contact: BusinessContact;
    socialLinks: SocialLink[];
  };
  theme: ThemeConfig;
  settings: CatalogSettings;
  seo: CatalogSeo;
  coverUrl: string | null;
  faviconUrl: string | null;
  categories: CatalogCategoryView[];
  items: CatalogItemView[];
  /** Atributos personalizados definidos por el negocio. */
  attributeDefs: AttributeDef[];
  pages: SitePage[];
  navigation: NavigationConfig;
  showBranding: boolean;
  /** URL absoluta de la raíz pública del sitio. */
  url: string;
  publishedAt: string | null;
  /** Reseñas aprobadas (sólo el sitio publicado y la demo las traen). */
  reviews?: PublicReview[];
};

export type SiteInput = {
  business: Pick<Tables<'businesses'>, 'name' | 'slug' | 'description' | 'logo_path' | 'contact' | 'social_links'> & { slogan?: string | null };
  catalog: Pick<Tables<'catalogs'>, 'theme' | 'settings' | 'seo' | 'cover_path' | 'favicon_path' | 'published_at'> & { navigation?: unknown; attribute_defs?: unknown };
  categories: CategoryInput[];
  items: ItemInput[];
  pages: Parameters<typeof pageFromRow>[0][];
  removeBranding: boolean;
};

export function buildSiteViewModel(input: SiteInput): SiteViewModel {
  const settings = parseCatalogSettings(input.catalog.settings);
  const categories = mapCategories(input.categories);
  const attributeDefs = parseAttributeDefs(input.catalog.attribute_defs);
  return {
    business: {
      name: input.business.name,
      slug: input.business.slug,
      description: input.business.description,
      slogan: input.business.slogan ?? null,
      logoUrl: publicStorageUrl(input.business.logo_path),
      contact: parseContact(input.business.contact),
      socialLinks: parseSocialLinks(input.business.social_links),
    },
    theme: parseTheme(input.catalog.theme),
    settings,
    seo: parseSeo(input.catalog.seo),
    coverUrl: publicStorageUrl(input.catalog.cover_path),
    faviconUrl: publicStorageUrl(input.catalog.favicon_path),
    categories,
    items: mapItems(input.items, categories, input.business.slug, { locale: settings.locale, attributeDefs, priceFormat: settings.priceFormat }),
    attributeDefs,
    pages: input.pages.map(pageFromRow),
    navigation: parseNavigation(input.catalog.navigation),
    showBranding: !input.removeBranding,
    url: catalogUrl(input.business.slug),
    publishedAt: input.catalog.published_at,
  };
}
