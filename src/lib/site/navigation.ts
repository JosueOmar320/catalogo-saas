import { z } from 'zod';
import { fieldFactory } from '@/lib/design/schema-utils';
import { resolveLink, type LinkContext } from './links';
import type { SitePage } from './pages';

/**
 * Menú del sitio (catalogs.navigation). Lista ordenada y explícita: páginas,
 * enlaces externos, WhatsApp, teléfono o email; cada ítem puede verse como
 * enlace o como botón. Es la única fuente de verdad del menú.
 */
function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  const item = z.object({
    id: z.string().min(1).max(64),
    kind: f(z.enum(['page', 'url', 'whatsapp', 'phone', 'email']), 'page'),
    pageId: f(z.string().max(64), ''),
    label: f(z.string().trim().max(40), ''),
    url: f(z.string().max(500), ''),
    visible: f(z.boolean(), true),
    style: f(z.enum(['link', 'button']), 'link'),
    newTab: f(z.boolean(), false),
  });
  return z.object({ items: f(z.array(item).max(30), []) });
}

export const navigationSchema = build(false);
const lenientNavigationSchema = build(true);

export type NavigationConfig = z.output<typeof navigationSchema>;
export type NavigationItem = NavigationConfig['items'][number];

export function parseNavigation(raw: unknown): NavigationConfig {
  const value = raw && typeof raw === 'object' ? raw : {};
  const result = lenientNavigationSchema.safeParse(value);
  return result.success ? result.data : { items: [] };
}

export type ResolvedNavItem = {
  id: string;
  label: string;
  href: string;
  external: boolean;
  style: 'link' | 'button';
  pageId: string | null;
};

const DEFAULT_LABELS = { url: 'Enlace', whatsapp: 'WhatsApp', phone: 'Llamar', email: 'Email' } as const;

/** Ítems visibles con su URL final. Omite páginas borradas o no publicadas. */
export function resolveNavigation(nav: NavigationConfig, pages: SitePage[], ctx: LinkContext): ResolvedNavItem[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  return nav.items.flatMap((item): ResolvedNavItem[] => {
    if (!item.visible) return [];
    if (item.kind === 'page') {
      const page = byId.get(item.pageId);
      if (!page || !page.isPublished) return [];
      const link = resolveLink({ kind: 'page', pageId: page.id, url: '', message: '', newTab: false }, ctx);
      return link ? [{ id: item.id, label: item.label || page.title, href: link.href, external: false, style: item.style, pageId: page.id }] : [];
    }
    const link = resolveLink({ kind: item.kind, pageId: '', url: item.url, message: '', newTab: item.newTab }, ctx);
    if (!link) return [];
    return [{ id: item.id, label: item.label || DEFAULT_LABELS[item.kind], href: link.href, external: link.external, style: item.style, pageId: null }];
  });
}

/** Menú por defecto: todas las páginas publicadas en su orden. */
export function navigationFromPages(pages: SitePage[]): NavigationConfig {
  return {
    items: pages.map((page) => ({
      id: crypto.randomUUID(),
      kind: 'page' as const,
      pageId: page.id,
      label: '',
      url: '',
      visible: true,
      style: 'link' as const,
      newTab: false,
    })),
  };
}
