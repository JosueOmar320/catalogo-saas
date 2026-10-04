import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planAssistantActions } from '@/features/assistant/executor';
import { resolveMediaQueries } from '@/features/assistant/server/resolve-media';
import { interpretLocally } from '@/features/assistant/server/router';
import type { MediaRecord } from '@/features/media/schema';
import type { BuilderState } from '@/features/builder/reducer';
import { parseActions } from '@/lib/assistant/actions';
import { buildAssistantContext } from '@/lib/assistant/context';
import { assertPublicHttpsUrl, SafeFetchError, sniffImage } from '@/lib/net/safe-fetch';
import { COLUMN_PRESETS, columnPreset } from '@/lib/site/column-presets';
import { pageSchema } from '@/lib/site/pages';
import { buildSampleSite } from '@/lib/site/sample-site';
import { COLUMN_BLOCK_KINDS, createColumnBlock, createSection, sectionSchema } from '@/lib/site/section-schemas';
import { applySiteTemplate, SITE_TEMPLATE_IDS } from '@/lib/site/templates';
import { mapEmbedSrc } from '@/lib/business/maps';

const site = buildSampleSite();
const BIZ = '11111111-2222-4333-8444-555555555555';

function state(): BuilderState {
  const home = site.pages.find((p) => p.isHome)!;
  return {
    theme: site.theme,
    navigation: site.navigation,
    pages: site.pages,
    persistedPageIds: site.pages.map((p) => p.id),
    deletedPageIds: [],
    selectedPageId: home.id,
    selectedSectionId: null,
    editingPageSettings: false,
    panel: 'pages',
    dirty: { theme: false, navigation: false, pages: false },
  };
}
const context = (s = state()) => buildAssistantContext({ site, pages: s.pages, theme: s.theme, navigation: s.navigation, panel: s.panel, currentPageId: s.selectedPageId, selectedSectionId: s.selectedSectionId, lastSectionIds: [] });

describe('Sección Columnas y plantillas de sitio', () => {
  it('cada tipo de bloque y cada composición son válidos', () => {
    for (const kind of COLUMN_BLOCK_KINDS) assert.equal(createColumnBlock(kind).kind, kind);
    for (const preset of COLUMN_PRESETS) {
      const section = createSection('columns', columnPreset(preset));
      assert.ok(sectionSchema.safeParse(section).success, preset);
    }
  });

  it('las 10 plantillas generan páginas válidas, con una sola página de inicio', () => {
    for (const id of SITE_TEMPLATE_IDS) {
      const result = applySiteTemplate({ theme: site.theme, pages: site.pages, navigation: site.navigation }, id, { topic: 'cafetería' });
      assert.ok(result.pages.length >= 1, id);
      assert.equal(result.pages.filter((p) => p.isHome).length, 1, `${id}: una sola portada`);
      for (const page of result.pages) assert.ok(pageSchema.safeParse(page).success, `${id}/${page.slug}`);
      assert.equal(result.navigation.items.length, result.pages.length);
      assert.equal(new Set(result.pages.map((p) => p.slug)).size, result.pages.length, `${id}: slugs únicos`);
    }
  });

  it('"agregar" conserva las páginas existentes y no duplica slugs', () => {
    const result = applySiteTemplate({ theme: site.theme, pages: site.pages, navigation: site.navigation }, 'restaurant', { mode: 'add' });
    assert.ok(site.pages.every((p) => result.pages.some((x) => x.id === p.id)));
    assert.equal(new Set(result.pages.map((p) => p.slug)).size, result.pages.length);
    assert.deepEqual(result.removedPageIds, []);
  });

  it('Garfield local: "agrega una sección de imagen y texto" crea una sección Columnas', () => {
    const local = interpretLocally('Agrega una sección de imagen y texto', context());
    const { actions, errors } = parseActions(local.actions);
    assert.deepEqual(errors, []);
    const plan = planAssistantActions(state(), actions);
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const home = plan.next.pages.find((p) => p.isHome)!;
    const created = home.sections.find((s) => s.type === 'columns');
    assert.ok(created);
    assert.equal(created.type === 'columns' && created.content.layout, '1-1');
  });

  it('Garfield crea Columnas sin ids (las pone el ejecutor)', () => {
    const { actions } = parseActions([{ action: 'create_section', section: { type: 'columns', content: { layout: '1-1-1', columns: [{ blocks: [{ kind: 'heading', text: 'Hola' }, { kind: 'list', items: [{ text: 'Uno' }] }] }, { blocks: [] }, { blocks: [] }] } } }]);
    const plan = planAssistantActions(state(), actions);
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
  });

  it('Garfield local: "quiero una web elegante para un restaurante" → plantilla (pide confirmación)', () => {
    const local = interpretLocally('Quiero una web elegante para un restaurante', context());
    const { actions } = parseActions(local.actions);
    assert.equal(actions[0].action, 'apply_site_template');
    assert.equal(local.creative, true, 'con IA disponible, la IA además personaliza los textos');
    const plan = planAssistantActions(state(), actions);
    assert.ok(plan.steps.every((s) => s.status === 'ok'), plan.steps.map((s) => s.error).join());
    assert.equal(plan.needsConfirmation, true);
    assert.ok(plan.next.deletedPageIds.length > 0, 'las páginas anteriores se eliminan al guardar');
    assert.equal(plan.next.pages.filter((p) => p.isHome).length, 1);
  });
});

describe('Imágenes por descripción (resueltas en el servidor)', () => {
  const record = (path: string, name: string, folder: MediaRecord['folder'] = 'images', provider: MediaRecord['provider'] = 'supabase'): MediaRecord => ({ id: path, path, name, alt: name, folder, source: 'upload', provider, url: `https://cdn/${path}`, thumbUrl: '', thumbPath: null, width: 800, height: 600, sizeBytes: 1, mimeType: 'image/jpeg', originalName: null, sourceUrl: null, attribution: null, createdAt: '' });
  const library = [record(`${BIZ}/media/tacos.jpg`, 'Tacos al pastor'), record(`${BIZ}/media/salon.jpg`, 'Salón'), record(`${BIZ}/media/logo.png`, 'Logo', 'logos'), record('https://cdn.example.com/x.jpg', 'Comida externa', 'images', 'external')];
  const fakeFind = (async (_scope: unknown, opts: { query?: string; folder?: string; limit?: number }) =>
    library.filter((m) => (!opts.folder || m.folder === opts.folder) && (!opts.query || `${m.name}`.toLowerCase().includes(opts.query.toLowerCase().split(' ')[0])))) as never;
  const scope = { supabase: null as never, businessId: BIZ };

  it('set_image con media.query → ruta real', async () => {
    const { actions, notes } = await resolveMediaQueries(scope, [{ action: 'set_image', section: 'type:hero', media: { query: 'tacos' }, target: 'background' }], fakeFind);
    assert.equal((actions[0] as { path?: string }).path, `${BIZ}/media/tacos.jpg`);
    assert.deepEqual(notes, []);
  });

  it('galería con las últimas N y sin repetir imágenes', async () => {
    const { actions } = await resolveMediaQueries(scope, [{ action: 'add_gallery_images', section: '$g', media: { latest: 3 } }], fakeFind);
    const images = (actions[0] as { images: { path: string }[] }).images;
    assert.equal(images.length, 3);
    assert.equal(new Set(images.map((i) => i.path)).size, 3);
  });

  it('logo: sólo archivos propios de la carpeta Logos y se muestra en el encabezado', async () => {
    const { actions } = await resolveMediaQueries(scope, [{ action: 'set_logo', media: { folder: 'logos' } }], fakeFind);
    assert.equal((actions[0] as { path?: string }).path, `${BIZ}/media/logo.png`);
    assert.equal(actions[1].action, 'update_theme');
  });

  it('sin coincidencias: lo explica y no inventa rutas', async () => {
    const { actions, notes } = await resolveMediaQueries(scope, [{ action: 'set_image', section: 'type:hero', media: { query: 'playa' } }], fakeFind);
    assert.equal((actions[0] as { path?: string }).path, undefined);
    assert.match(notes[0], /playa/);
  });
});

describe('Descarga segura: validación de URL', () => {
  it('rechaza http, credenciales, puertos y hosts internos', () => {
    for (const url of ['http://example.com/a.jpg', 'https://user:pw@example.com/a.jpg', 'https://example.com:8443/a.jpg', 'https://localhost/a.jpg', 'https://metadata.google.internal/a', 'https://127.0.0.1/a.jpg', 'https://[::1]/a.jpg', 'https://169.254.169.254/latest', 'https://printer.local/a.jpg', 'notaurl']) {
      assert.throws(() => assertPublicHttpsUrl(url), SafeFetchError, url);
    }
    assert.equal(assertPublicHttpsUrl('https://images.example.com/a.jpg').hostname, 'images.example.com');
  });

  it('reconoce GIF y AVIF además de JPEG/PNG/WebP', () => {
    assert.equal(sniffImage(new TextEncoder().encode('GIF89a......'))?.mime, 'image/gif');
    const avif = new Uint8Array([0, 0, 0, 0x1c, ...new TextEncoder().encode('ftypavif')]);
    assert.equal(sniffImage(avif)?.mime, 'image/avif');
    assert.equal(sniffImage(new TextEncoder().encode('<html>')), null);
  });

  it('el mapa sigue funcionando con la ubicación guardada', () => {
    assert.match(mapEmbedSrc({ mapsLocation: '12.1,-86.2' })!, /output=embed/);
  });
});

describe('Imágenes: si la biblioteca no tiene, fotos libres', () => {
  const BIZ2 = '22222222-2222-4333-8444-555555555555';
  const scope = { supabase: null as never, businessId: BIZ2 };
  const empty = (async () => []) as never;

  it('biblioteca vacía → importa fotos libres y las usa (hero y galería)', async () => {
    const calls: [string, number][] = [];
    const stock = async (query: string, count: number) => {
      calls.push([query, count]);
      return Array.from({ length: count }, (_, i) => `${BIZ2}/media/${query.replace(/\s/g, '-')}-${i}.jpg`);
    };
    const { actions, notes } = await resolveMediaQueries(
      scope,
      [
        { action: 'set_image', section: '$hero', media: { query: 'abandoned laboratory' }, target: 'background' },
        { action: 'add_gallery_images', section: '$gal', media: { query: 'foggy forest', latest: 4 } },
      ],
      empty,
      stock,
    );
    assert.equal((actions[0] as { path?: string }).path, `${BIZ2}/media/abandoned-laboratory-0.jpg`);
    assert.equal((actions[1] as { images: unknown[] }).images.length, 4);
    assert.deepEqual(calls, [['abandoned laboratory', 1], ['foggy forest', 4]]);
    assert.match(notes[0], /fotos libres/);
  });

  it('nunca para logos, y con tope por respuesta', async () => {
    let imported = 0;
    const stock = async (_q: string, count: number) => {
      imported += count;
      return Array.from({ length: count }, (_, i) => `${BIZ2}/media/x-${imported}-${i}.jpg`);
    };
    const { actions } = await resolveMediaQueries(scope, [{ action: 'set_logo', media: { query: 'logo', folder: 'logos' } }, { action: 'add_gallery_images', section: '$g', media: { query: 'a', latest: 40 } }], empty, stock);
    assert.equal((actions[0] as { path?: string }).path, undefined);
    assert.ok(imported <= 10);
  });
});

describe('Páginas ricas: imágenes dentro de secciones y dirección de arte', () => {
  const BIZ3 = '33333333-2222-4333-8444-555555555555';
  const scope = { supabase: null as never, businessId: BIZ3 };
  const empty = (async () => []) as never;
  const stock = async (query: string, count: number) => Array.from({ length: count }, (_, i) => `${BIZ3}/media/${query.replace(/\s/g, '-')}-${i}.jpg`);

  it('media dentro de create_page: fondo del hero, imagen de columnas, foto de equipo y galería', async () => {
    const { actions } = await resolveMediaQueries(
      scope,
      [
        {
          action: 'create_page',
          title: 'Historia',
          sections: [
            { type: 'hero', content: { title: 'Hola' }, style: { background: { type: 'image', media: { query: 'abandoned laboratory' } } } },
            { type: 'columns', content: { layout: '1-1', columns: [{ blocks: [{ kind: 'image', image: { media: { query: 'old mansion' } } }] }, { blocks: [] }] } },
            { type: 'team', content: { members: [{ name: 'Ana', photo: { media: { query: 'scientist' } } }] } },
            { type: 'gallery', content: { images: [{ media: { query: 'dark forest', latest: 4 } }] } },
          ],
        },
      ],
      empty,
      stock,
    );
    const sections = (actions[0] as { sections: Record<string, any>[] }).sections; // eslint-disable-line @typescript-eslint/no-explicit-any
    assert.equal(sections[0].style.background.image.path, `${BIZ3}/media/abandoned-laboratory-0.jpg`);
    assert.equal(sections[0].style.background.type, 'image');
    assert.equal(sections[1].content.columns[0].blocks[0].image.path, `${BIZ3}/media/old-mansion-0.jpg`);
    assert.equal(sections[2].content.members[0].photo, `${BIZ3}/media/scientist-0.jpg`);
    assert.equal(sections[3].content.images.length, 4);
    assert.ok(!JSON.stringify(actions).includes('"media"'), 'no quedan consultas sin resolver');

    // El ejecutor la acepta (las imágenes vienen validadas por el servidor) y le da ritmo visual.
    const allowedMedia = [...JSON.stringify(actions).matchAll(/"(33333333[^"]+)"/g)].map((m) => m[1]);
    const plan = planAssistantActions(state(), parseActions(actions).actions, { allowedMedia });
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const page = plan.next.pages.find((p) => p.title === 'Historia')!;
    const hero = page.sections[0];
    assert.equal(hero.style.background.type, 'image');
    assert.ok(hero.style.background.overlay.opacity > 0, 'imagen de fondo con overlay');
    assert.equal(hero.style.textColor, 'light');
  });

  it('dirección de arte: alterna fondos y respeta los fondos propios', async () => {
    const { artDirect } = await import('@/lib/site/art-direction');
    const sections = [
      createSection('hero', { title: 'x' }),
      createSection('features'),
      createSection('columns', columnPreset('imageText')),
      createSection('testimonials'),
      createSection('stats', { items: [{ id: '1', value: '10', label: 'años' }] }),
      createSection('faq', {}, { background: { type: 'color', color: '#123456' } }),
      createSection('contact'),
    ];
    const out = artDirect(sections, site.theme, 'balanced');
    assert.equal(out[0].style.background.type, 'gradient', 'portada con degradado de marca');
    assert.ok(out.some((s) => s.style.background.type === 'color' && s.type !== 'faq' && s.type !== 'stats'), 'alguna banda suave');
    assert.equal(out[4].style.textColor, 'light', 'cifras en banda de marca');
    assert.equal(out[5].style.background.type === 'color' && out[5].style.background.color, '#123456', 'el fondo del usuario no se toca');
    for (const s of out) assert.ok(sectionSchema.safeParse(s).success);
    const bold = artDirect(sections, site.theme, 'bold');
    assert.ok(bold.some((s) => s.style.dividerTop.shape !== 'none'), 'bold agrega divisores');
  });

  it('modo local: "hazla más llamativa" y "pon imágenes de fondo en las secciones"', () => {
    const polish = interpretLocally('Hazla más llamativa', context());
    assert.deepEqual(polish.actions, [{ action: 'polish_page', page: 'current', intensity: 'bold' }]);
    const plan = planAssistantActions(state(), parseActions(polish.actions).actions);
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const bg = interpretLocally('Pon imágenes de fondo en las secciones', context());
    assert.ok(bg.actions.filter((a) => a.action === 'set_image').length >= 2);
  });
});
