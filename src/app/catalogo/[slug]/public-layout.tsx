import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildHeaderProps, footerColumns, SiteFooter, SiteFrame, SiteHeader, SiteShell } from '@/site-renderer';
import { FooterGate } from '@/site-renderer/ChromeGate';
import siteStyles from '@/site-renderer/site.module.css';
import { getPublicSite } from '@/features/catalog/public-queries';
import { siteMetadata } from '@/lib/catalog/metadata';
import { siteStatusTexts } from '@/site-renderer/status';
import { orderConfig } from '@/site-renderer/order/config';
import { ReviewInvite } from '@/site-renderer/ReviewInvite';
import { ViewTracker } from '@/site-renderer/ViewTracker';
import { SiteCustomCss } from '@/site-renderer/SiteCustomCss';

/**
 * Lo compartido por /catalogo/<negocio> y por el dominio propio del negocio
 * (/dominio/<negocio>, al que el proxy reescribe mitienda.com): el mismo
 * sitio, con los enlaces bajo `basePath` ("/catalogo/<negocio>" o "").
 */
export async function publicSiteMetadata(slug: string): Promise<Metadata> {
  const site = await getPublicSite(slug);
  return site ? siteMetadata(site) : { title: siteStatusTexts().unavailable, robots: { index: false } };
}

/** Header y footer compartidos: al navegar entre páginas no se vuelven a renderizar. */
export async function PublicSiteLayoutContent({ slug, basePath, children }: { slug: string; basePath: string; children: React.ReactNode }) {
  const site = await getPublicSite(slug);
  if (!site) notFound();
  const env = { mode: 'public', basePath, currentPageId: null } as const;
  const header = buildHeaderProps(site, env);

  return (
    <SiteShell theme={site.theme} language={site.settings.language} order={orderConfig(site, { track: true })} showBranding={site.showBranding} htmlLang>
      <SiteCustomCss site={site} />
      <SiteFrame theme={site.theme} header={<SiteHeader {...header} />}>
        <main className={siteStyles.main}>{children}</main>
        <FooterGate hiddenPaths={header.footerHiddenPaths}>
          <SiteFooter site={site} navItems={header.items} columns={footerColumns(site, env)} />
        </FooterGate>
      </SiteFrame>
      {site.siteKind === 'catalog' && site.settings.reviews.enabled && <ReviewInvite slug={site.business.slug} businessName={site.business.name} />}
      <ViewTracker slug={site.business.slug} basePath={basePath} />
    </SiteShell>
  );
}
