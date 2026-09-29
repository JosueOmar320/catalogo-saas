import { z } from 'zod';
import type { ThemeConfig } from '@/lib/design/theme';
import type { NavigationConfig } from '@/lib/site/navigation';
import type { SitePage } from '@/lib/site/pages';
import type { Section } from '@/lib/site/section-schemas';
import type { SiteViewModel } from '@/lib/site/view-model';

/**
 * Contexto del editor que recibe Garfield: una FOTO COMPACTA del borrador
 * (sin imágenes, sin textos largos) para que entienda "esta sección", "la de
 * productos" o "esa página" sin enviar todo el sitio.
 */
const text = (max: number) => z.string().max(max);
const sectionSummary = z.object({
  id: text(64),
  type: text(20),
  title: text(160),
  name: text(60),
  visible: z.boolean(),
  details: text(300),
});

export const assistantContextSchema = z.object({
  business: z.object({ name: text(120), slogan: text(200), description: text(400) }),
  panel: z.enum(['pages', 'navigation', 'design']),
  currentPageId: text(64),
  selectedSectionId: text(64).nullable(),
  lastSectionIds: z.array(text(64)).max(10),
  pages: z
    .array(
      z.object({
        id: text(64),
        title: text(80),
        slug: text(60),
        isHome: z.boolean(),
        published: z.boolean(),
        inNav: z.boolean(),
        sections: z.array(sectionSummary).max(40),
      }),
    )
    .max(40),
  theme: z.object({
    preset: text(40),
    colors: z.record(text(20), text(7)),
    fonts: z.object({ heading: text(30), body: text(30) }),
    header: text(20),
    footer: text(20),
    cards: text(20),
    background: text(80),
    radius: z.number(),
    buttons: text(40),
  }),
  navigation: z.array(z.object({ id: text(64), kind: text(10), label: text(80), pageId: text(64), visible: z.boolean(), style: text(10) })).max(30),
  catalog: z.object({
    products: z.number().int(),
    services: z.number().int(),
    featured: z.number().int(),
    onSale: z.number().int(),
    categories: z.array(z.object({ id: text(64), name: text(80) })).max(100),
    attributes: z.array(z.object({ id: text(40), name: text(40), type: text(10), options: z.array(text(40)).max(40) })).max(40),
  }),
  /** Los agrega el SERVIDOR (no se confía en el cliente): últimas imágenes y productos. */
  media: z.array(z.object({ path: text(300), alt: text(300), source: text(10) })).max(40).optional(),
  products: z.array(z.object({ id: text(64), name: text(160), type: text(10), category: text(80), price: z.number().nullable(), featured: z.boolean(), hasImage: z.boolean() })).max(80).optional(),
});
export type AssistantContext = z.infer<typeof assistantContextSchema>;

function sectionDetails(section: Section): string {
  const c = section.content as Record<string, unknown>;
  switch (section.type) {
    case 'products':
    case 'services': {
      const { collection: col, presentation: p } = section.content;
      return `colección=${col.source}${col.limit ? ` (máx ${col.limit})` : ''} · layout=${p.layout} · columnas=${p.columns.desktop}/${p.columns.tablet}/${p.columns.mobile} · imagen=${p.imageSize}/${p.shape}`;
    }
    case 'catalog': {
      const { presentation: p, pagination, sort } = section.content;
      return `layout=${p.layout} · columnas=${p.columns.desktop}/${p.columns.tablet}/${p.columns.mobile} · paginación=${pagination.mode} · orden=${sort.default}`;
    }
    case 'features':
    case 'testimonials':
      return `${(c.items as unknown[]).length} ítems · layout=${String(c.layout)}`;
    case 'gallery':
      return `${(c.images as unknown[]).length} imágenes · layout=${String(c.layout)}`;
    case 'hero':
    case 'banner':
      return `layout=${String(c.layout)} · altura=${String(c.height)} · fondo=${section.style.background.type}`;
    default:
      return 'layout' in c ? `layout=${String(c.layout)}` : '';
  }
}

export function buildAssistantContext(input: {
  site: SiteViewModel;
  pages: SitePage[];
  theme: ThemeConfig;
  navigation: NavigationConfig;
  panel: AssistantContext['panel'];
  currentPageId: string;
  selectedSectionId: string | null;
  lastSectionIds: string[];
}): AssistantContext {
  const { site, theme } = input;
  const inNav = (pageId: string) => input.navigation.items.some((i) => i.kind === 'page' && i.pageId === pageId && i.visible);
  const bg = theme.background;
  return {
    business: { name: site.business.name.slice(0, 120), slogan: (site.business.slogan ?? '').slice(0, 200), description: (site.business.description ?? '').slice(0, 400) },
    panel: input.panel,
    currentPageId: input.currentPageId,
    selectedSectionId: input.selectedSectionId,
    lastSectionIds: input.lastSectionIds.slice(-10),
    pages: input.pages.slice(0, 40).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      isHome: p.isHome,
      published: p.isPublished,
      inNav: inNav(p.id),
      sections: p.sections.slice(0, 40).map((s) => {
        const c = s.content as { title?: string };
        return { id: s.id, type: s.type, title: (c.title ?? '').slice(0, 160), name: s.name, visible: s.visible, details: sectionDetails(s).slice(0, 300) };
      }),
    })),
    theme: {
      preset: theme.preset,
      colors: { primary: theme.colors.primary, accent: theme.colors.accent, background: theme.colors.background, text: theme.colors.text, heading: theme.colors.heading },
      fonts: { heading: theme.typography.headingFont, body: theme.typography.bodyFont },
      header: theme.header.style,
      footer: theme.footer.style,
      cards: theme.cards.style,
      background: bg.type === 'color' ? `color ${bg.color}` : bg.type === 'gradient' ? `degradado ${bg.gradient.from}→${bg.gradient.to}` : bg.type,
      radius: theme.shape.radius,
      buttons: `${theme.buttons.style}/${theme.buttons.shape}`,
    },
    navigation: input.navigation.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      label: (i.label || input.pages.find((p) => p.id === i.pageId)?.title || i.kind).slice(0, 80),
      pageId: i.pageId,
      visible: i.visible,
      style: i.style,
    })),
    catalog: {
      products: site.items.filter((i) => i.type === 'product').length,
      services: site.items.filter((i) => i.type === 'service').length,
      featured: site.items.filter((i) => i.isFeatured).length,
      onSale: site.items.filter((i) => i.compareAtLabel !== null).length,
      categories: site.categories.slice(0, 100).map((c) => ({ id: c.id, name: c.name.slice(0, 80) })),
      attributes: site.attributeDefs.map((d) => ({ id: d.id, name: d.name, type: d.type, options: d.options.slice(0, 40) })),
    },
  };
}
