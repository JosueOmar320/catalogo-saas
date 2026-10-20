import { z } from 'zod';
import { fieldFactory } from '@/lib/design/schema-utils';
import { resolveLink, type LinkContext } from './links';
import type { SitePage } from './pages';

/**
 * Menú del sitio (catalogs.navigation). Lista ordenada y explícita: páginas,
 * enlaces externos, WhatsApp, teléfono o email; cada ítem puede verse como
 * enlace o como botón. Es la única fuente de verdad del menú.
 *
 * Submenús (un nivel): un ítem con `parentId` se muestra dentro de otro ítem
 * de primer nivel (una página o un "grupo", que sólo tiene texto). La lista
 * sigue siendo plana y el orden de los hijos es el de la lista.
 */
function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  const item = z.object({
    id: z.string().min(1).max(64),
    kind: f(z.enum(['page', 'url', 'whatsapp', 'phone', 'email', 'group']), 'page'),
    pageId: f(z.string().max(64), ''),
    label: f(z.string().trim().max(40), ''),
    url: f(z.string().max(500), ''),
    visible: f(z.boolean(), true),
    style: f(z.enum(['link', 'button']), 'link'),
    newTab: f(z.boolean(), false),
    parentId: f(z.string().max(64), ''),
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
  /** Vacío en un grupo (sólo abre su submenú). */
  href: string;
  external: boolean;
  style: 'link' | 'button';
  pageId: string | null;
  /** Submenú (sólo en el primer nivel). */
  children: ResolvedNavItem[];
};

const DEFAULT_LABELS = { url: 'Enlace', whatsapp: 'WhatsApp', phone: 'Llamar', email: 'Email', group: 'Más' } as const;

/**
 * Padre efectivo de un ítem: sólo cuenta si existe y es de primer nivel
 * (un submenú no tiene submenús); si no, el ítem queda en el primer nivel.
 */
export function navParent(item: NavigationItem, items: NavigationItem[]): NavigationItem | null {
  if (!item.parentId || item.parentId === item.id) return null;
  const parent = items.find((i) => i.id === item.parentId);
  return parent && !parent.parentId ? parent : null;
}

/** Ítems visibles con su URL final. Omite páginas borradas o no publicadas y grupos vacíos. */
export function resolveNavigation(nav: NavigationConfig, pages: SitePage[], ctx: LinkContext): ResolvedNavItem[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const resolve = (item: NavigationItem): ResolvedNavItem | null => {
    if (!item.visible) return null;
    const base = { id: item.id, style: item.style, children: [] };
    if (item.kind === 'group') return { ...base, label: item.label || ctx.texts?.group || DEFAULT_LABELS.group, href: '', external: false, pageId: null, style: 'link' };
    if (item.kind === 'page') {
      const page = byId.get(item.pageId);
      if (!page || !page.isPublished) return null;
      const link = resolveLink({ kind: 'page', pageId: page.id, url: '', message: '', newTab: false }, ctx);
      return link ? { ...base, label: item.label || page.title, href: link.href, external: false, pageId: page.id } : null;
    }
    const link = resolveLink({ kind: item.kind, pageId: '', url: item.url, message: '', newTab: item.newTab }, ctx);
    if (!link) return null;
    return { ...base, label: item.label || (item.kind === 'whatsapp' ? DEFAULT_LABELS.whatsapp : ctx.texts?.[item.kind]) || DEFAULT_LABELS[item.kind], href: link.href, external: link.external, pageId: null };
  };
  return nav.items.flatMap((item): ResolvedNavItem[] => {
    if (navParent(item, nav.items)) return [];
    const top = resolve(item);
    if (!top) return [];
    // En un submenú todo se ve como enlace.
    const children = nav.items.filter((child) => navParent(child, nav.items)?.id === item.id).flatMap((child) => {
      const resolved = resolve(child);
      return resolved && child.kind !== 'group' ? [{ ...resolved, style: 'link' as const }] : [];
    });
    if (item.kind === 'group' && children.length === 0) return [];
    return [{ ...top, children }];
  });
}

/** Menú y submenús en una sola lista (para el pie de página). */
export function flattenNavigation(items: ResolvedNavItem[]): ResolvedNavItem[] {
  return items.flatMap((item) => [...(item.href ? [item] : []), ...item.children]);
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
      parentId: '',
    })),
  };
}
