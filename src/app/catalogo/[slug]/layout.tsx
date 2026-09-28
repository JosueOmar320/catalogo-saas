import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildHeaderProps, SiteFooter, SiteHeader, SiteShell } from '@/site-renderer';
import siteStyles from '@/site-renderer/site.module.css';
import { getPublicSite } from '@/features/catalog/public-queries';
import { siteMetadata } from '@/lib/catalog/metadata';

// ISR: se sirve desde caché y se invalida por tag cuando el dueño guarda cambios.
export const revalidate = 3600;

export async function generateMetadata({ params }: LayoutProps<'/catalogo/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  return site ? siteMetadata(site) : { title: 'No disponible', robots: { index: false } };
}

/** Header y footer compartidos: al navegar entre páginas no se vuelven a renderizar. */
export default async function PublicSiteLayout({ children, params }: LayoutProps<'/catalogo/[slug]'>) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();
  const header = buildHeaderProps(site, { mode: 'public', basePath: `/catalogo/${slug}`, currentPageId: null });

  return (
    <SiteShell theme={site.theme}>
      <SiteHeader {...header} />
      <main className={siteStyles.main}>{children}</main>
      <SiteFooter site={site} navItems={header.items} />
    </SiteShell>
  );
}
