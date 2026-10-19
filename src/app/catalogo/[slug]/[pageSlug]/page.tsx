import type { Metadata } from 'next';
import { getPublicSite } from '@/features/catalog/public-queries';
import { pageMetadata } from '@/lib/catalog/metadata';
import { siteStatusTexts } from '@/site-renderer/status';
import { renderPublicPage } from '../site-page';

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/catalogo/[slug]/[pageSlug]'>): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const site = await getPublicSite(slug);
  const page = site?.pages.find((p) => p.slug === pageSlug);
  return site && page ? pageMetadata(site, page) : { title: siteStatusTexts(site?.settings.language).notFound, robots: { index: false } };
}

/** Páginas creadas por el usuario: /catalogo/negocio/promociones, /menu, /paquetes… */
export default async function PublicSitePage({ params }: PageProps<'/catalogo/[slug]/[pageSlug]'>) {
  const { slug, pageSlug } = await params;
  return renderPublicPage(slug, pageSlug);
}
