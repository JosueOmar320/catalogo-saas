import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canUndo, historyReducer, initHistory } from '@/features/builder/history';
import type { BuilderState } from '@/features/builder/reducer';
import { pageToRow } from '@/lib/site/pages';
import { buildSampleSite } from '@/lib/site/sample-site';
import { dropMediaRefs, parseSiteSnapshot } from '@/lib/site/versions';

const site = buildSampleSite();
/** La copia tal como la guarda record_site_version (filas de catalog_pages). */
const raw = (pages = site.pages) => ({ theme: site.theme, navigation: site.navigation, pages: pages.map(pageToRow) });

function initial(): BuilderState {
  return {
    theme: site.theme,
    navigation: site.navigation,
    pages: site.pages,
    persistedPageIds: site.pages.map((p) => p.id),
    deletedPageIds: [],
    selectedPageId: site.pages[1].id,
    selectedSectionId: null,
    editingPageSettings: false,
    panel: 'pages',
    dirty: { theme: false, navigation: false, pages: false },
  };
}

describe('Historial del sitio: versiones', () => {
  it('la copia guardada vuelve a ser el sitio del editor', () => {
    const snapshot = parseSiteSnapshot(raw());
    assert.ok(snapshot);
    assert.deepEqual(snapshot.pages, site.pages);
    assert.deepEqual(snapshot.navigation, site.navigation);
    assert.equal(snapshot.theme.preset, site.theme.preset);
  });

  it('tolerante: sin páginas → null; sin inicio, la primera lo es (y queda publicada)', () => {
    assert.equal(parseSiteSnapshot(null), null);
    assert.equal(parseSiteSnapshot({ theme: {}, pages: [] }), null);
    assert.equal(parseSiteSnapshot({ pages: [{ title: 'Sin id' }] }), null);
    const rows = raw().pages.map((p) => ({ ...p, is_home: false, is_published: false }));
    const snapshot = parseSiteSnapshot({ pages: rows, theme: 'roto', navigation: 7 });
    assert.ok(snapshot);
    assert.deepEqual(snapshot.pages.map((p) => [p.isHome, p.isPublished]), [[true, true], ...rows.slice(1).map(() => [false, false])]);
    assert.deepEqual(snapshot.navigation, { items: [] });
  });

  it('las imágenes que ya no existen se quitan: la suelta queda vacía y en una galería sale el elemento', () => {
    const gone = 'https://cdn.test/borrada.jpg';
    const value = { hero: { image: { path: gone } }, gallery: [{ path: gone, caption: 'x' }, { path: 'ok.jpg', caption: 'y' }], team: [{ name: 'Ana', photo: gone }], seo: { ogImagePath: gone } };
    assert.deepEqual(dropMediaRefs(value, new Set([gone])), {
      hero: { image: { path: null } },
      gallery: [{ path: 'ok.jpg', caption: 'y' }],
      team: [{ name: 'Ana', photo: null }],
      seo: { ogImagePath: null },
    });
    assert.equal(dropMediaRefs(value, new Set()), value, 'sin imágenes inválidas, el mismo objeto');
  });

  it('abrir una versión: borrador completo, las páginas que sobran se borran al guardar y se puede deshacer', () => {
    const [home, second] = site.pages;
    const snapshot = parseSiteSnapshot(raw([{ ...home, title: 'Inicio de antes' }]))!;
    let h = initHistory(initial());
    h = historyReducer(h, { type: 'do', action: { type: 'restoreVersion', snapshot }, at: 1 });
    assert.equal(h.present.pages.length, 1);
    assert.equal(h.present.pages[0].title, 'Inicio de antes');
    assert.equal(h.present.selectedPageId, home.id, 'se abre en la página de inicio');
    assert.deepEqual(h.present.deletedPageIds, site.pages.slice(1).map((p) => p.id));
    assert.deepEqual(h.present.dirty, { theme: true, navigation: true, pages: true });
    assert.ok(canUndo(h));

    h = historyReducer(h, { type: 'undo' });
    assert.equal(h.present.pages.length, site.pages.length);
    assert.ok(h.present.pages.some((p) => p.id === second.id));
    assert.deepEqual(h.present.deletedPageIds, []);
    assert.deepEqual(h.present.dirty, { theme: false, navigation: false, pages: false });
  });
});
