import { resolveCollection } from '@/lib/catalog/collections';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { backgroundTone, resolveBackground, type Background } from '@/lib/design/background';
import { isDark } from '@/lib/design/color';
import type { ThemeConfig } from '@/lib/design/theme';
import type { SectionOf } from './section-schemas';
import type { SiteViewModel } from './view-model';

/**
 * Lógica compartida por el render web y el PDF: qué ítems muestra una
 * sección, qué badges tiene un ítem, qué color de texto usar sobre un fondo.
 */
type ItemSourceContent = SectionOf<'products'>['content'] | SectionOf<'services'>['content'];

/** Ítems de una sección de productos o servicios (colección dinámica). */
export function resolveSectionItems(content: ItemSourceContent, items: CatalogItemView[], options: { ignoreLimit?: boolean } = {}): CatalogItemView[] {
  return resolveCollection(content.collection, items, options);
}

export type ResolvedBadge = { key: string; label: string; color: string };

export function resolveBadges(item: CatalogItemView, theme: ThemeConfig): ResolvedBadge[] {
  const b = theme.badges;
  const out: ResolvedBadge[] = [];
  const push = (key: 'new' | 'featured' | 'sale' | 'popular' | 'soldOut') => {
    if (!out.some((x) => x.key === key)) out.push({ key, label: b[key].label, color: b[key].color });
  };
  if (!item.isAvailable && b.autoSoldOut) push('soldOut');
  if (item.compareAtLabel && b.autoSale) push('sale');
  if (item.isFeatured && b.autoFeatured) push('featured');
  for (const badge of item.badges) push(badge);
  if (item.customBadge) out.push({ key: 'custom', label: item.customBadge.label, color: item.customBadge.color });
  return out.slice(0, 3);
}

/** Modo de texto de una sección: "light" = texto claro sobre fondo oscuro. */
export function resolveTextMode(textColor: 'auto' | 'light' | 'dark', sectionBackground: Background, theme: ThemeConfig): 'light' | 'dark' | null {
  if (textColor !== 'auto') return textColor;
  if (sectionBackground.type === 'inherit') return null;
  const tone = backgroundTone(resolveBackground(sectionBackground));
  if (!tone) return null;
  const themeTextIsLight = !isDark(theme.colors.text);
  if (isDark(tone) && !themeTextIsLight) return 'light';
  if (!isDark(tone) && themeTextIsLight) return 'dark';
  return null;
}

/** Textos del hero con respaldo en los datos del negocio. */
export function heroText(content: SectionOf<'hero'>['content'], site: Pick<SiteViewModel, 'business'>) {
  return {
    eyebrow: content.eyebrow,
    title: content.title || site.business.name,
    subtitle: content.subtitle || site.business.slogan || site.business.description || '',
  };
}

export function firstVisibleSection<T extends { visible: boolean }>(sections: T[]): T | undefined {
  return sections.find((s) => s.visible);
}

/** El header "transparente" se superpone sólo si la página empieza con un hero. */
export function headerOverlaysPage(theme: ThemeConfig, sections: { visible: boolean; type: string }[]): boolean {
  return theme.header.style === 'transparent' && firstVisibleSection(sections)?.type === 'hero';
}
