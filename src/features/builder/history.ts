import { builderReducer, type BuilderAction, type BuilderState } from './reducer';

/**
 * Deshacer / rehacer del editor del sitio, como capa pura sobre builderReducer.
 *
 * · Sólo los cambios de contenido (tema, navegación, páginas, secciones) crean
 *   historia; seleccionar, cambiar de pestaña o guardar no.
 * · Agrupa: escribir en un campo (mismo destino, < 1 s entre cambios) o varias
 *   acciones casi simultáneas (un plan de Garfield) son un solo paso.
 * · "Sin guardar" se calcula contra lo último guardado: deshacer hasta ese
 *   punto deja el editor limpio.
 */
export type ContentSnapshot = Pick<BuilderState, 'theme' | 'navigation' | 'pages'>;

export type HistoryState = {
  present: BuilderState;
  past: ContentSnapshot[];
  future: ContentSnapshot[];
  /** Último contenido guardado (referencias): para saber qué quedó sin guardar. */
  saved: ContentSnapshot;
  last: { key: string; at: number } | null;
};

export type HistoryAction = { type: 'do'; action: BuilderAction; at: number } | { type: 'undo' } | { type: 'redo' };

export const HISTORY_LIMIT = 100;
const TYPING_MS = 1000;
const BATCH_MS = 40;

const CONTENT_ACTIONS = new Set<BuilderAction['type']>([
  'setTheme',
  'setNavigation',
  'addPage',
  'updatePage',
  'removePage',
  'duplicatePage',
  'reorderPages',
  'setHome',
  'addSection',
  'updateSection',
  'removeSection',
  'duplicateSection',
  'reorderSections',
]);

/** A qué "cosa" afecta la acción: dos cambios seguidos a lo mismo se agrupan. */
function targetKey(action: BuilderAction, state: BuilderState): string {
  switch (action.type) {
    case 'updateSection':
      return `section:${action.section.id}`;
    case 'updatePage':
      return `page:${action.pageId}`;
    case 'setTheme':
      return 'theme';
    case 'setNavigation':
      return 'navigation';
    default:
      return `${action.type}:${'pageId' in action ? (action.pageId ?? state.selectedPageId) : ''}`;
  }
}

const snapshot = (state: BuilderState): ContentSnapshot => ({ theme: state.theme, navigation: state.navigation, pages: state.pages });

function dirtyAgainst(state: Pick<BuilderState, 'theme' | 'navigation' | 'pages'>, saved: ContentSnapshot) {
  return { theme: state.theme !== saved.theme, navigation: state.navigation !== saved.navigation, pages: state.pages !== saved.pages };
}

/** Vuelve a un contenido anterior conservando la selección cuando sigue existiendo. */
function restore(state: BuilderState, content: ContentSnapshot, saved: ContentSnapshot): BuilderState {
  const pages = content.pages;
  const selectedPage = pages.find((p) => p.id === state.selectedPageId) ?? pages.find((p) => p.isHome) ?? pages[0];
  const sectionStillThere = selectedPage?.sections.some((s) => s.id === state.selectedSectionId);
  return {
    ...state,
    ...content,
    selectedPageId: selectedPage.id,
    selectedSectionId: sectionStillThere ? state.selectedSectionId : null,
    // Una página ya guardada que no está en el contenido restaurado se borra al guardar.
    deletedPageIds: state.persistedPageIds.filter((id) => !pages.some((p) => p.id === id)),
    dirty: dirtyAgainst(content, saved),
  };
}

export function initHistory(present: BuilderState): HistoryState {
  // Un sitio inicial (aún sin guardar) cuenta como pendiente: su "último guardado" es vacío.
  const saved: ContentSnapshot = {
    theme: present.theme,
    navigation: present.dirty.navigation ? { items: [] } : present.navigation,
    pages: present.dirty.pages ? [] : present.pages,
  };
  return { present, past: [], future: [], saved, last: null };
}

export function historyReducer(history: HistoryState, action: HistoryAction): HistoryState {
  const { present } = history;
  switch (action.type) {
    case 'undo': {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return { ...history, present: restore(present, previous, history.saved), past: history.past.slice(0, -1), future: [snapshot(present), ...history.future], last: null };
    }
    case 'redo': {
      const next = history.future[0];
      if (!next) return history;
      return { ...history, present: restore(present, next, history.saved), past: [...history.past, snapshot(present)], future: history.future.slice(1), last: null };
    }
    case 'do': {
      const inner = action.action;
      const next = builderReducer(present, inner);
      if (inner.type === 'reset') return initHistory(next);
      if (inner.type === 'saved') return { ...history, present: next, saved: { theme: inner.saved.theme, navigation: inner.saved.navigation, pages: inner.saved.pages }, last: null };
      if (!CONTENT_ACTIONS.has(inner.type) || next === present) return { ...history, present: next };

      const key = targetKey(inner, present);
      const coalesce = history.last !== null && (action.at - history.last.at < BATCH_MS || (history.last.key === key && action.at - history.last.at < TYPING_MS));
      const past = coalesce ? history.past : [...history.past, snapshot(present)].slice(-HISTORY_LIMIT);
      return { ...history, present: { ...next, dirty: dirtyAgainst(next, history.saved) }, past, future: [], last: { key, at: action.at } };
    }
  }
}

export const canUndo = (history: HistoryState) => history.past.length > 0;
export const canRedo = (history: HistoryState) => history.future.length > 0;
