import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { richTextToPlain } from '@/lib/design/rich-text';
import { pagePath } from '@/lib/site/links';
import type { SitePage } from '@/lib/site/pages';
import type { SiteViewModel } from '@/lib/site/view-model';
import { mediaUrl } from '@/lib/utils/storage';

/** Imágenes para compartir generadas (features/og): la del catálogo y la de cada producto. Siempre en la plataforma (también con dominio propio). */
export const catalogOgImage = (site: SiteViewModel) => `${env.siteUrl}/og/catalogo/${site.business.slug}`;
export const itemOgImage = (site: SiteViewModel, itemSlug: string) => `${env.siteUrl}/og/catalogo/${site.business.slug}/p/${itemSlug}`;

/** SEO global del sitio (se hereda en todas las páginas). Sin imagen propia, se usa la generada. */
export function siteMetadata(site: SiteViewModel): Metadata {
  const description = site.seo.description || site.business.slogan || site.business.description || `Sitio de ${site.business.name}`;
  const image = mediaUrl(site.seo.ogImagePath) ?? catalogOgImage(site);
  return {
    title: { default: site.seo.title || site.business.name, template: `%s · ${site.business.name}` },
    description,
    icons: site.faviconUrl ? { icon: site.faviconUrl, apple: site.faviconUrl } : undefined,
    robots: site.seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { type: 'website', siteName: site.business.name, locale: site.settings.language === 'en' ? 'en_US' : 'es_ES', description, images: image ? [{ url: image }] : undefined },
  };
}

/** SEO por página: sobrescribe al del sitio. La página de inicio usa el título del sitio. */
export function pageMetadata(site: SiteViewModel, page: SitePage): Metadata {
  const base = siteMetadata(site);
  // site.url es la raíz pública (dominio propio o /catalogo/<negocio>).
  const url = page.isHome ? site.url : `${site.url}${pagePath('', page)}`;
  const heroText = page.sections.find((s) => s.type === 'text' && s.content.body);
  const description =
    page.seo.description ||
    (page.isHome ? undefined : heroText && heroText.type === 'text' ? richTextToPlain(heroText.content.body).slice(0, 155) : undefined) ||
    (base.description as string);
  const title = page.seo.title || (page.isHome ? site.seo.title || site.business.name : page.title);
  const image = mediaUrl(page.seo.ogImagePath) ?? (base.openGraph?.images as { url: string }[] | undefined)?.[0]?.url;
  return {
    title: page.isHome || page.seo.title ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    robots: page.seo.noindex || site.seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { ...base.openGraph, url, title, description, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
  };
}
