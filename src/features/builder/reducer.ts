import type { ThemeConfig } from '@/lib/design/theme';
import type { NavigationConfig } from '@/lib/site/navigation';
import type { SitePage } from '@/lib/site/pages';
import type { Section } from '@/lib/site/section-schemas';

/**
 * Estado del builder: un borrador local del sitio. Todo se edita en memoria
 * (con preview instantánea) y se guarda de una vez con saveSite.
 */
export type BuilderPanel = 'pages' | 'navigation' | 'design';

export type BuilderState = {
  theme: ThemeConfig;
  navigation: NavigationConfig;
  pages: SitePage[];
  persistedPageIds: string[];
  deletedPageIds: string[];
  selectedPageId: string;
  selectedSectionId: string | null;
  editingPageSettings: boolean;
  panel: BuilderPanel;
  dirty: { theme: boolean; navigation: boolean; pages: boolean };
};

export type BuilderAction =
  | { type: 'setPanel'; panel: BuilderPanel }
  | { type: 'setTheme'; theme: ThemeConfig }
  | { type: 'setNavigation'; navigation: NavigationConfig }
  | { type: 'selectPage'; pageId: string }
  | { type: 'selectSection'; sectionId: string | null }
  | { type: 'editPageSettings'; open: boolean }
  | { type: 'addPage'; page: SitePage; showInNav: boolean }
  | { type: 'updatePage'; pageId: string; patch: Partial<SitePage> }
  | { type: 'removePage'; pageId: string }
  | { type: 'duplicatePage'; pageId: string }
  | { type: 'reorderPages'; ids: string[] }
  | { type: 'setHome'; pageId: string }
  // `pageId` opcional: por defecto, la página seleccionada (lo usa el asistente para editar otras páginas).
  | { type: 'addSection'; section: Section; index?: number; pageId?: string }
  | { type: 'updateSection'; section: Section; pageId?: string }
  | { type: 'removeSection'; sectionId: string; pageId?: string }
  | { type: 'duplicateSection'; sectionId: string; pageId?: string }
  | { type: 'reorderSections'; ids: string[]; pageId?: string }
  /** `saved` es el estado que se envió: lo editado mientras se guardaba sigue pendiente. */
  | { type: 'saved'; saved: Pick<BuilderState, 'theme' | 'navigation' | 'pages' | 'deletedPageIds'> }
  | { type: 'reset'; state: BuilderState };

function mapPage(state: BuilderState, pageId: string, fn: (page: SitePage) => SitePage): SitePage[] {
  return state.pages.map((p) => (p.id === pageId ? fn(p) : p));
}

function uniqueSlug(base: string, pages: SitePage[]): string {
  const taken = new Set(pages.map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 55)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const pagesChanged = (state: BuilderState, pages: SitePage[], extra: Partial<BuilderState> = {}): BuilderState => ({
  ...state,
  ...extra,
  pages,
  dirty: { ...state.dirty, pages: true, ...(extra.navigation ? { navigation: true } : {}) },
});

type SectionAction = Extract<BuilderAction, { type: 'addSection' | 'updateSection' | 'removeSection' | 'duplicateSection' | 'reorderSections' }>;
const isSectionAction = (action: BuilderAction): action is SectionAction =>
  action.type === 'addSection' || action.type === 'updateSection' || action.type === 'removeSection' || action.type === 'duplicateSection' || action.type === 'reorderSections';

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const targetId = isSectionAction(action) ? (action.pageId ?? state.selectedPageId) : state.selectedPageId;
  const page = state.pages.find((p) => p.id === targetId) ?? state.pages[0];
  switch (action.type) {
    case 'setPanel':
      return { ...state, panel: action.panel, selectedSectionId: null, editingPageSettings: false };
    case 'setTheme':
      return { ...state, theme: action.theme, dirty: { ...state.dirty, theme: true } };
    case 'setNavigation':
      return { ...state, navigation: action.navigation, dirty: { ...state.dirty, navigation: true } };
    case 'selectPage':
      return { ...state, selectedPageId: action.pageId, selectedSectionId: null, editingPageSettings: false };
    case 'selectSection':
      return { ...state, selectedSectionId: action.sectionId, editingPageSettings: false, panel: 'pages' };
    case 'editPageSettings':
      return { ...state, editingPageSettings: action.open, selectedSectionId: null };

    case 'addPage': {
      const newPage = { ...action.page, slug: uniqueSlug(action.page.slug, state.pages) };
      const navigation = action.showInNav
        ? { items: [...state.navigation.items, { id: crypto.randomUUID(), kind: 'page' as const, pageId: newPage.id, label: '', url: '', visible: true, style: 'link' as const, newTab: false }] }
        : state.navigation;
      return pagesChanged(state, [...state.pages, newPage], { navigation, selectedPageId: newPage.id, selectedSectionId: null });
    }
    case 'updatePage':
      return pagesChanged(state, mapPage(state, action.pageId, (p) => ({ ...p, ...action.patch })));
    case 'removePage': {
      if (state.pages.length <= 1) return state;
      const target = state.pages.find((p) => p.id === action.pageId);
      let pages = state.pages.filter((p) => p.id !== action.pageId);
      if (target?.isHome) pages = pages.map((p, i) => (i === 0 ? { ...p, isHome: true } : p));
      const navigation = { items: state.navigation.items.filter((i) => !(i.kind === 'page' && i.pageId === action.pageId)) };
      return pagesChanged(state, pages, {
        navigation,
        selectedPageId: state.selectedPageId === action.pageId ? pages[0].id : state.selectedPageId,
        selectedSectionId: null,
        deletedPageIds: state.persistedPageIds.includes(action.pageId) ? [...state.deletedPageIds, action.pageId] : state.deletedPageIds,
      });
    }
    case 'duplicatePage': {
      const source = state.pages.find((p) => p.id === action.pageId);
      if (!source) return state;
      const copy: SitePage = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        title: `${source.title} (copia)`.slice(0, 80),
        slug: uniqueSlug(`${source.slug}-copia`, state.pages),
        isHome: false,
        sections: source.sections.map((s) => ({ ...structuredClone(s), id: crypto.randomUUID() })),
      };
      const index = state.pages.findIndex((p) => p.id === source.id);
      const pages = [...state.pages.slice(0, index + 1), copy, ...state.pages.slice(index + 1)];
      return pagesChanged(state, pages, { selectedPageId: copy.id, selectedSectionId: null });
    }
    case 'reorderPages': {
      const byId = new Map(state.pages.map((p) => [p.id, p]));
      return pagesChanged(state, action.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
    }
    case 'setHome':
      return pagesChanged(state, state.pages.map((p) => ({ ...p, isHome: p.id === action.pageId, isPublished: p.id === action.pageId ? true : p.isPublished })));

    case 'addSection': {
      const sections = [...page.sections];
      sections.splice(action.index ?? sections.length, 0, action.section);
      return { ...pagesChanged(state, mapPage(state, page.id, (p) => ({ ...p, sections }))), selectedSectionId: action.section.id };
    }
    case 'updateSection':
      return pagesChanged(state, mapPage(state, page.id, (p) => ({ ...p, sections: p.sections.map((s) => (s.id === action.section.id ? action.section : s)) })));
    case 'removeSection':
      return {
        ...pagesChanged(state, mapPage(state, page.id, (p) => ({ ...p, sections: p.sections.filter((s) => s.id !== action.sectionId) }))),
        selectedSectionId: state.selectedSectionId === action.sectionId ? null : state.selectedSectionId,
      };
    case 'duplicateSection': {
      const index = page.sections.findIndex((s) => s.id === action.sectionId);
      if (index < 0) return state;
      const copy = { ...structuredClone(page.sections[index]), id: crypto.randomUUID() };
      const sections = [...page.sections.slice(0, index + 1), copy, ...page.sections.slice(index + 1)];
      return { ...pagesChanged(state, mapPage(state, page.id, (p) => ({ ...p, sections }))), selectedSectionId: copy.id };
    }
    case 'reorderSections': {
      const byId = new Map(page.sections.map((s) => [s.id, s]));
      return pagesChanged(state, mapPage(state, page.id, (p) => ({ ...p, sections: action.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])) })));
    }
    case 'saved': {
      // Cada edición crea objetos nuevos: si la referencia cambió, hubo cambios durante el guardado.
      const { saved } = action;
      return {
        ...state,
        persistedPageIds: [...new Set([...state.persistedPageIds.filter((id) => !saved.deletedPageIds.includes(id)), ...saved.pages.map((p) => p.id)])],
        deletedPageIds: state.deletedPageIds.filter((id) => !saved.deletedPageIds.includes(id)),
        dirty: {
          theme: state.dirty.theme && state.theme !== saved.theme,
          navigation: state.dirty.navigation && state.navigation !== saved.navigation,
          pages: state.dirty.pages && state.pages !== saved.pages,
        },
      };
    }
    case 'reset':
      return action.state;
  }
}

