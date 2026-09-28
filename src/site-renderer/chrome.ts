import { resolveLink } from '@/lib/site/links';
import { resolveNavigation, type ResolvedNavItem } from '@/lib/site/navigation';
import { pagePath } from '@/lib/site/links';
import { headerOverlaysPage } from '@/lib/site/resolve';
import type { SiteViewModel } from '@/lib/site/view-model';
import { linkContext, type RenderEnv } from './env';

export type HeaderProps = {
  header: SiteViewModel['theme']['header'];
  brand: { name: string; logoUrl: string | null };
  items: ResolvedNavItem[];
  cta: { label: string; href: string; external: boolean; pageId?: string } | null;
  social: SiteViewModel['business']['socialLinks'];
  /** Rutas de las páginas donde el header se superpone al hero. */
  overlayPaths: string[];
  homePath: string;
  /** Ruta actual (preview). En público se usa usePathname(). */
  currentPath?: string;
};

/** Datos serializables del header/footer (se calculan una vez en el servidor). */
export function buildHeaderProps(site: SiteViewModel, env: RenderEnv, currentPath?: string): HeaderProps {
  const links = linkContext(site, env);
  const pages = links.pages as SiteViewModel['pages'];
  const header = site.theme.header;
  let cta: HeaderProps['cta'] = null;
  if (header.cta === 'whatsapp') {
    const link = resolveLink({ kind: 'whatsapp', pageId: '', url: '', message: '', newTab: true }, links);
    if (link) cta = { label: header.ctaLabel || 'WhatsApp', ...link };
  } else if (header.cta === 'contact') {
    const contactPage = pages.find((p) => p.template === 'contact' || p.sections.some((s) => s.type === 'contact'));
    const link = contactPage
      ? resolveLink({ kind: 'page', pageId: contactPage.id, url: '', message: '', newTab: false }, links)
      : resolveLink({ kind: 'whatsapp', pageId: '', url: '', message: '', newTab: true }, links);
    if (link) cta = { label: header.ctaLabel || 'Contáctanos', ...link };
  }
  return {
    header,
    brand: { name: site.business.name, logoUrl: site.business.logoUrl },
    items: resolveNavigation(site.navigation, pages, links),
    cta,
    social: header.showSocial ? site.business.socialLinks : [],
    overlayPaths: pages.filter((p) => headerOverlaysPage(site.theme, p.sections)).map((p) => pagePath(env.basePath, p)),
    homePath: env.basePath || '/',
    currentPath,
  };
}
