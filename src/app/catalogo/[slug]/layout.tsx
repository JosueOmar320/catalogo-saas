import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildHeaderProps, footerColumns, SiteFooter, SiteHeader, SiteShell } from '@/site-renderer';
import { FooterGate } from '@/site-renderer/ChromeGate';
import siteStyles from '@/site-renderer/site.module.css';
import { getPublicSite } from '@/features/catalog/public-queries';
import { siteMetadata } from '@/lib/catalog/metadata';
import { siteStatusTexts } from '@/site-renderer/status';
import { orderConfig } from '@/site-renderer/order/config';
import { ViewTracker } from '@/site-renderer/ViewTracker';

// ISR: se sirve desde caché y se invalida por tag cuando el dueño guarda cambios.
export const revalidate = 3600;

export async function generateMetadata({ params }: LayoutProps<'/catalogo/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  return site ? siteMetadata(site) : { title: siteStatusTexts().unavailable, robots: { index: false } };
}

/** Header y footer compartidos: al navegar entre páginas no se vuelven a renderizar. */
export default async function PublicSiteLayout({ children, params }: LayoutProps<'/catalogo/[slug]'>) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();
  const env = { mode: 'public', basePath: `/catalogo/${slug}`, currentPageId: null } as const;
  const header = buildHeaderProps(site, env);

  return (
    <SiteShell theme={site.theme} language={site.settings.language} order={orderConfig(site, { track: true })}>
      <SiteHeader {...header} />
      <main className={siteStyles.main}>{children}</main>
      <FooterGate hiddenPaths={header.footerHiddenPaths}>
        <SiteFooter site={site} navItems={header.items} columns={footerColumns(site, env)} />
      </FooterGate>
      <ViewTracker slug={site.business.slug} />
    </SiteShell>
  );
}
