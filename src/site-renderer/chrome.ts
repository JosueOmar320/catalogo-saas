import { resolveLink, type LinkContext } from '@/lib/site/links';
import { resolveNavigation, type ResolvedNavItem } from '@/lib/site/navigation';
import { pagePath } from '@/lib/site/links';
import { headerOverlaysPage } from '@/lib/site/resolve';
import type { SiteViewModel } from '@/lib/site/view-model';
import { defaultText } from './default-texts';
import { linkContext, type RenderEnv } from './env';
import { siteTranslator } from './site-i18n';

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
  /** Barra de anuncios (null si está apagada o sin texto). */
  announcement: AnnouncementProps | null;
};

export type AnnouncementProps = {
  text: string;
  /** Sin `label`, todo el texto es el enlace. */
  link: { label: string; href: string; external: boolean } | null;
  tone: 'accent' | 'dark' | 'soft';
  /** Último día ("2026-10-31") y zona horaria: se oculta sola al terminar. */
  endsOn: string;
  timeZone: string;
  dismissible: boolean;
  /** Clave para recordar que el visitante la cerró (cambia si cambia el texto). */
  storageKey: string;
};

function announcementProps(site: SiteViewModel, links: LinkContext): AnnouncementProps | null {
  const bar = site.theme.announcement;
  if (!bar.enabled || !bar.text) return null;
  const target = bar.link.kind === 'none' ? null : resolveLink(bar.link, links);
  return {
    text: bar.text,
    link: target ? { label: bar.linkLabel, href: target.href, external: target.external } : null,
    tone: bar.tone,
    endsOn: bar.endsOn,
    timeZone: bar.timeZone,
    dismissible: bar.dismissible,
    storageKey: `announcement:${site.business.slug}:${bar.text.length}:${bar.text.slice(0, 40)}`,
  };
}

/** Datos serializables del header/footer (se calculan una vez en el servidor). */
export function buildHeaderProps(site: SiteViewModel, env: RenderEnv, currentPath?: string): HeaderProps {
  const links = linkContext(site, env);
  const pages = links.pages as SiteViewModel['pages'];
  const header = site.theme.header;
  const t = siteTranslator(site.settings.language);
  // Mensaje de WhatsApp en el idioma del sitio (vacío, lib/site/links usaría el de fábrica en español).
  const message = t('Hola {name}, quisiera más información.', { name: site.business.name });
  const label = (fallback: string) => (header.ctaLabel ? defaultText(header.ctaLabel, t) : fallback);
  let cta: HeaderProps['cta'] = null;
  if (header.cta === 'whatsapp') {
    const link = resolveLink({ kind: 'whatsapp', pageId: '', url: '', message, newTab: true }, links);
    if (link) cta = { label: label('WhatsApp'), ...link };
  } else if (header.cta === 'contact') {
    const contactPage = pages.find((p) => p.template === 'contact' || p.sections.some((s) => s.type === 'contact'));
    const link = contactPage
      ? resolveLink({ kind: 'page', pageId: contactPage.id, url: '', message: '', newTab: false }, links)
      : resolveLink({ kind: 'whatsapp', pageId: '', url: '', message, newTab: true }, links);
    if (link) cta = { label: label(t('Contáctanos')), ...link };
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
    announcement: announcementProps(site, links),
  };
}
