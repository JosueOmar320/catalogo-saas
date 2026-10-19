import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canRedo, canUndo, HISTORY_LIMIT, historyReducer, initHistory, type HistoryState } from '@/features/builder/history';
import type { BuilderAction, BuilderState } from '@/features/builder/reducer';
import { buildSampleSite } from '@/lib/site/sample-site';

function initial(): BuilderState {
  const site = buildSampleSite();
  return {
    theme: site.theme,
    navigation: site.navigation,
    pages: site.pages,
    persistedPageIds: site.pages.map((p) => p.id),
    deletedPageIds: [],
    selectedPageId: site.pages[0].id,
    selectedSectionId: null,
    editingPageSettings: false,
    panel: 'pages',
    dirty: { theme: false, navigation: false, pages: false },
  };
}

let clock = 0;
const run = (h: HistoryState, action: BuilderAction, gap = 5_000) => historyReducer(h, { type: 'do', action, at: (clock += gap) });
const title = (h: HistoryState) => h.present.pages[0].title;

describe('Builder: deshacer y rehacer', () => {
  it('deshace y rehace cambios de contenido; seleccionar no crea historia', () => {
    let h = initHistory(initial());
    const pageId = h.present.pages[0].id;
    h = run(h, { type: 'selectPage', pageId: h.present.pages[1].id });
    assert.equal(canUndo(h), false);
    h = run(h, { type: 'updatePage', pageId, patch: { title: 'Uno' } });
    h = run(h, { type: 'setTheme', theme: { ...h.present.theme } });
    assert.equal(h.past.length, 2);

    h = historyReducer(h, { type: 'undo' });
    h = historyReducer(h, { type: 'undo' });
    assert.equal(title(h), 'Inicio');
    assert.deepEqual(h.present.dirty, { theme: false, navigation: false, pages: false }, 'volver a lo guardado deja todo limpio');
    assert.equal(h.present.selectedPageId, h.present.pages[1].id, 'la selección se conserva');

    h = historyReducer(h, { type: 'redo' });
    assert.equal(title(h), 'Uno');
    assert.equal(h.present.dirty.pages, true);
    assert.equal(canRedo(h), true);
    h = run(h, { type: 'updatePage', pageId, patch: { title: 'Otro' } });
    assert.equal(canRedo(h), false, 'una edición nueva borra lo que se podía rehacer');
  });

  it('escribir en un mismo campo es un solo paso; un plan de Garfield también', () => {
    let h = initHistory(initial());
    const pageId = h.present.pages[0].id;
    for (const text of ['C', 'Ca', 'Caf', 'Café']) h = run(h, { type: 'updatePage', pageId, patch: { title: text } }, 200);
    assert.equal(h.past.length, 1);
    // Varias acciones casi simultáneas sobre cosas distintas.
    h = run(h, { type: 'setTheme', theme: { ...h.present.theme } }, 5_000);
    h = run(h, { type: 'updatePage', pageId: h.present.pages[1].id, patch: { title: 'X' } }, 1);
    h = run(h, { type: 'setNavigation', navigation: { items: [] } }, 1);
    assert.equal(h.past.length, 2);
    h = historyReducer(h, { type: 'undo' });
    assert.equal(title(h), 'Café');
    assert.notDeepEqual(h.present.navigation.items, []);
  });

  it('deshacer el borrado de una página guardada la recupera y ya no se borra al guardar', () => {
    let h = initHistory(initial());
    const removed = h.present.pages[1].id;
    h = run(h, { type: 'removePage', pageId: removed });
    assert.deepEqual(h.present.deletedPageIds, [removed]);
    h = historyReducer(h, { type: 'undo' });
    assert.ok(h.present.pages.some((p) => p.id === removed));
    assert.deepEqual(h.present.deletedPageIds, []);
    h = historyReducer(h, { type: 'redo' });
    assert.deepEqual(h.present.deletedPageIds, [removed]);
  });

  it('después de guardar, deshacer vuelve a dejar cambios pendientes', () => {
    let h = initHistory(initial());
    h = run(h, { type: 'updatePage', pageId: h.present.pages[0].id, patch: { title: 'Guardado' } });
    const { theme, navigation, pages, deletedPageIds } = h.present;
    h = run(h, { type: 'saved', saved: { theme, navigation, pages, deletedPageIds } });
    assert.equal(h.present.dirty.pages, false);
    h = historyReducer(h, { type: 'undo' });
    assert.equal(h.present.dirty.pages, true);
  });

  it('un sitio inicial sin guardar empieza pendiente; descartar limpia la historia', () => {
    const starter = { ...initial(), dirty: { theme: false, navigation: true, pages: true } };
    let h = initHistory(starter);
    h = run(h, { type: 'updatePage', pageId: h.present.pages[0].id, patch: { title: 'Y' } });
    h = historyReducer(h, { type: 'undo' });
    assert.deepEqual(h.present.dirty, { theme: false, navigation: true, pages: true });
    h = run(h, { type: 'reset', state: initial() });
    assert.equal(canUndo(h), false);
  });

  it('la historia tiene un límite', () => {
    let h = initHistory(initial());
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = run(h, { type: 'updatePage', pageId: h.present.pages[0].id, patch: { title: `T${i}` } });
    assert.equal(h.past.length, HISTORY_LIMIT);
  });
});
