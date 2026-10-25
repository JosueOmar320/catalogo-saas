import type { Metadata } from 'next';
import { getPublicSite } from '@/features/catalog/public-queries';
import { pageMetadata } from '@/lib/catalog/metadata';
import { findHome } from '@/lib/site/pages';
import { renderPublicPage } from '@/app/catalogo/[slug]/site-page';

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/dominio/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  const home = site && findHome(site.pages);
  return site && home ? pageMetadata(site, home) : {};
}

export default async function DomainHomePage({ params }: PageProps<'/dominio/[slug]'>) {
  const { slug } = await params;
  return renderPublicPage(slug, undefined, '');
}
