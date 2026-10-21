import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { builderReducer, type BuilderState } from '@/features/builder/reducer';
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

describe('Builder: la página de inicio siempre está publicada', () => {
  it('no se puede despublicar la página de inicio', () => {
    const first = initial();
    const home = first.pages.find((p) => p.isHome)!;
    const state = builderReducer(first, { type: 'updatePage', pageId: home.id, patch: { isPublished: false } });
    assert.equal(state.pages.find((p) => p.id === home.id)!.isPublished, true);
    // Las demás sí.
    const other = first.pages.find((p) => !p.isHome)!;
    assert.equal(builderReducer(first, { type: 'updatePage', pageId: other.id, patch: { isPublished: false } }).pages.find((p) => p.id === other.id)!.isPublished, false);
  });

  it('al borrar el inicio, la que pasa a ser inicio queda publicada aunque estuviera oculta', () => {
    const first = initial();
    const home = first.pages.find((p) => p.isHome)!;
    const next = first.pages.find((p) => !p.isHome)!;
    let state = builderReducer(first, { type: 'updatePage', pageId: next.id, patch: { isPublished: false } });
    state = builderReducer(state, { type: 'reorderPages', ids: [home.id, next.id, ...state.pages.filter((p) => p.id !== home.id && p.id !== next.id).map((p) => p.id)] });
    state = builderReducer(state, { type: 'removePage', pageId: home.id });
    assert.equal(state.pages[0].id, next.id);
    assert.deepEqual([state.pages[0].isHome, state.pages[0].isPublished], [true, true]);
    assert.equal(state.pages.filter((p) => p.isHome).length, 1);
  });
});

describe('Builder: guardado', () => {
  it('después de guardar sin más cambios, nada queda pendiente', () => {
    let state = builderReducer(initial(), { type: 'updatePage', pageId: initial().pages[0].id, patch: { title: 'Inicio nuevo' } });
    assert.equal(state.dirty.pages, true);
    const saved = { theme: state.theme, navigation: state.navigation, pages: state.pages, deletedPageIds: state.deletedPageIds };
    state = builderReducer(state, { type: 'saved', saved });
    assert.deepEqual(state.dirty, { theme: false, navigation: false, pages: false });
  });

  it('regresión: lo editado MIENTRAS se guardaba sigue pendiente', () => {
    const first = initial();
    let state = builderReducer(first, { type: 'updatePage', pageId: first.pages[0].id, patch: { title: 'A' } });
    const saved = { theme: state.theme, navigation: state.navigation, pages: state.pages, deletedPageIds: state.deletedPageIds };
    // El usuario sigue escribiendo antes de que responda el servidor.
    state = builderReducer(state, { type: 'updatePage', pageId: first.pages[0].id, patch: { title: 'AB' } });
    state = builderReducer(state, { type: 'saved', saved });
    assert.equal(state.dirty.pages, true, 'el cambio "AB" no se guardó: debe seguir pendiente');
    assert.equal(state.pages[0].title, 'AB');
  });

  it('una página borrada durante el guardado sigue en la lista de borrados', () => {
    const first = initial();
    let state = builderReducer(first, { type: 'removePage', pageId: first.pages[1].id });
    const saved = { theme: state.theme, navigation: state.navigation, pages: state.pages, deletedPageIds: state.deletedPageIds };
    state = builderReducer(state, { type: 'removePage', pageId: first.pages[2].id });
    state = builderReducer(state, { type: 'saved', saved });
    assert.deepEqual(state.deletedPageIds, [first.pages[2].id]);
    assert.ok(!state.persistedPageIds.includes(first.pages[1].id));
  });
});
