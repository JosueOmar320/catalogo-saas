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
  /** Rutas de las páginas sin header / sin pie de página (landings). */
  headerHiddenPaths: string[];
  footerHiddenPaths: string[];
  homePath: string;
  /** Ruta actual (preview). En público se usa usePathname(). */
  currentPath?: string;
  /** Barra de anuncios (null si está apagada o sin texto). */
  announcement: AnnouncementProps | null;
  /** Ventana de bienvenida (null si está apagada, sin título o en la vista previa). */
  popup: PopupProps | null;
};

export type PopupProps = {
  title: string;
  text: string;
  code: string;
  button: { label: string; href: string; external: boolean } | null;
  delay: number;
  endsOn: string;
  timeZone: string;
  /** Clave para recordar que el visitante ya la vio (cambia si cambia el contenido). */
  storageKey: string;
};

/** Huella corta (djb2) del contenido: si el negocio cambia la promoción, se vuelve a mostrar. */
const fingerprint = (text: string) => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
};

function popupProps(site: SiteViewModel, links: LinkContext, env: RenderEnv): PopupProps | null {
  const popup = site.theme.popup;
  if (!popup.enabled || !popup.title || env.mode === 'preview') return null;
  const target = popup.link.kind === 'none' ? null : resolveLink(popup.link, links);
  return {
    title: popup.title,
    text: popup.text,
    code: popup.code,
    button: target ? { label: popup.buttonLabel || siteTranslator(site.settings.language)('Ver más'), href: target.href, external: target.external } : null,
    delay: popup.delay,
    endsOn: popup.endsOn,
    timeZone: popup.timeZone,
    storageKey: `popup:${site.business.slug}:${fingerprint([popup.title, popup.text, popup.code].join('|'))}`,
  };
}

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

export type FooterColumn = { id: string; title: string; links: { id: string; label: string; href: string; external: boolean; pageId?: string }[] };

/** Columnas propias del pie de página con sus URLs finales (sin enlaces que no se pueden resolver ni columnas vacías). */
export function footerColumns(site: SiteViewModel, env: RenderEnv): FooterColumn[] {
  const links = linkContext(site, env);
  return site.theme.footer.columns.flatMap((column) => {
    const resolved = column.links.flatMap((item) => {
      const target = resolveLink(item.link, links);
      const page = item.link.kind === 'page' ? site.pages.find((p) => p.id === item.link.pageId) : undefined;
      if (!target || (page && !page.isPublished)) return [];
      const label = item.label || page?.title || '';
      return label ? [{ id: item.id, label, ...target }] : [];
    });
    return resolved.length > 0 ? [{ id: column.id, title: column.title, links: resolved }] : [];
  });
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
    overlayPaths: pages.filter((p) => headerOverlaysPage(site.theme, p.sections, p.style.header)).map((p) => pagePath(env.basePath, p)),
    headerHiddenPaths: pages.filter((p) => p.style.header === 'hidden').map((p) => pagePath(env.basePath, p)),
    footerHiddenPaths: pages.filter((p) => p.style.hideFooter).map((p) => pagePath(env.basePath, p)),
    homePath: env.basePath || '/',
    currentPath,
    announcement: announcementProps(site, links),
    popup: popupProps(site, links, env),
  };
}
