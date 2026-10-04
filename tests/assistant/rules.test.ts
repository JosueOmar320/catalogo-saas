import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseActions } from '@/lib/assistant/actions';
import { buildAssistantContext } from '@/lib/assistant/context';
import { planAssistantActions } from '@/features/assistant/executor';
import { rulesRespond } from '@/features/assistant/server/rules';
import type { BuilderState } from '@/features/builder/reducer';
import { buildSampleSite } from '@/lib/site/sample-site';
import { pageSchema } from '@/lib/site/pages';
import { presentation } from '@/lib/catalog/presentation';
import { discountPercent } from '@/lib/catalog/view-model';
import { parseVideoUrl } from '@/lib/site/video';
import { createSection, SECTION_TYPES } from '@/lib/site/section-schemas';

const site = buildSampleSite();

function stateWith(select?: (s: BuilderState) => Partial<BuilderState>): BuilderState {
  const home = site.pages.find((p) => p.isHome)!;
  const base: BuilderState = {
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
  return { ...base, ...select?.(base) };
}

/** Pedido en español → modo básico → acciones validadas → plan sobre el borrador. */
function ask(text: string, state = stateWith()) {
  const context = buildAssistantContext({ site, pages: state.pages, theme: state.theme, navigation: state.navigation, panel: state.panel, currentPageId: state.selectedPageId, selectedSectionId: state.selectedSectionId, lastSectionIds: [] });
  const response = rulesRespond(text, context);
  const { actions, errors } = parseActions(response.actions);
  assert.deepEqual(errors, [], `acciones inválidas para "${text}"`);
  const plan = planAssistantActions(state, actions);
  for (const step of plan.steps) assert.equal(step.status, 'ok', `"${text}" → ${step.label}: ${step.error}`);
  for (const page of plan.next.pages) assert.ok(pageSchema.safeParse(page).success);
  return { response, actions, plan };
}

const homeOf = (s: BuilderState) => s.pages.find((p) => p.isHome)!;
const selectType = (type: string) => (s: BuilderState) => ({ selectedSectionId: homeOf(s).sections.find((x) => x.type === type)!.id });

describe('Garfield AI · modo básico con los pedidos del documento', () => {
  it('"Créame una página de inicio para mi restaurante."', () => {
    const { actions, plan } = ask('Créame una página de inicio para mi restaurante.');
    assert.equal(actions[0].action, 'create_page');
    assert.ok(plan.next.pages.length === site.pages.length + 1);
  });

  it('"Agrega una sección de productos destacados."', () => {
    const { plan } = ask('Agrega una sección de productos destacados.');
    const added = plan.next.pages.find((p) => p.id === plan.focus.pageId)!.sections.find((x) => x.id === plan.focus.sectionId)!;
    assert.ok(added.type === 'products' && added.content.collection.source === 'featured');
  });

  it('"Quiero que esta sección tenga 4 productos por fila."', () => {
    const state = stateWith(selectType('products'));
    const { plan } = ask('Quiero que esta sección tenga 4 productos por fila.', state);
    const section = homeOf(plan.next).sections.find((x) => x.id === state.selectedSectionId)!;
    assert.ok(section.type === 'products' && section.content.presentation.columns.desktop === 4);
  });

  it('"Haz que el encabezado sea más elegante."', () => {
    assert.equal(ask('Haz que el encabezado sea más elegante.').plan.next.theme.header.style, 'elegant');
  });

  it('"Agrega una sección de contacto al final."', () => {
    assert.equal(homeOf(ask('Agrega una sección de contacto al final.').plan.next).sections.at(-1)!.type, 'contact');
  });

  it('"Cambia el fondo a un color claro."', () => {
    const { plan } = ask('Cambia el fondo a un color claro.');
    assert.equal(plan.next.theme.background.type, 'color');
    assert.equal(plan.next.theme.background.color, '#FAF8F5');
  });

  it('"Quiero una página de servicios."', () => {
    const { plan } = ask('Quiero una página de servicios.');
    assert.ok(plan.next.pages.at(-1)!.sections.some((x) => x.type === 'services'));
  });

  it('"Mueve esta sección arriba de la sección de productos."', () => {
    const state = stateWith(selectType('contact'));
    const types = homeOf(ask('Mueve esta sección arriba de la sección de productos.', state).plan.next).sections.map((x) => x.type);
    assert.equal(types.indexOf('contact') + 1, types.indexOf('products'));
  });

  it('"Haz que los productos tengan una imagen más grande."', () => {
    const { plan } = ask('Haz que los productos tengan una imagen más grande.');
    const products = homeOf(plan.next).sections.find((x) => x.type === 'products')!;
    assert.ok(products.type === 'products' && products.content.presentation.imageSize === 'lg');
  });

  it('"Agrega una sección de promociones."', () => {
    const { plan } = ask('Agrega una sección de promociones.');
    const sections = homeOf(plan.next).sections;
    const banner = sections.findIndex((x) => x.type === 'banner' && (x.content as { title: string }).title.includes('Promociones'));
    assert.ok(banner >= 0);
    const next = sections[banner + 1];
    assert.ok(next.type === 'products' && next.content.collection.source === 'sale');
  });

  it('"Quiero que la página se vea más moderna." pide confirmación', () => {
    const { plan } = ask('Quiero que la página se vea más moderna.');
    assert.equal(plan.next.theme.preset, 'modern');
    assert.equal(plan.needsConfirmation, true);
  });

  it('"Crea una página de nosotros."', () => {
    assert.equal(ask('Crea una página de nosotros.').plan.next.pages.at(-1)!.template, 'about');
  });

  it('"Duplica esta sección."', () => {
    const state = stateWith(selectType('hero'));
    const { plan } = ask('Duplica esta sección y cambia su contenido.', state);
    assert.equal(homeOf(plan.next).sections.filter((x) => x.type === 'hero').length, 2);
  });

  it('"Elimina esta sección" requiere confirmación', () => {
    const state = stateWith(selectType('testimonials'));
    const { plan } = ask('Elimina esta sección', state);
    assert.equal(plan.needsConfirmation, true);
  });

  it('pedido desconocido: no inventa acciones', () => {
    const context = buildAssistantContext({ site, pages: site.pages, theme: site.theme, navigation: site.navigation, panel: 'pages', currentPageId: site.pages[0].id, selectedSectionId: null, lastSectionIds: [] });
    assert.equal(rulesRespond('cuéntame un chiste de perros', context).actions.length, 0);
  });
});

describe('Secciones y presentaciones v4', () => {
  const lastSection = (plan: ReturnType<typeof ask>['plan']) => {
    const home = plan.next.pages.find((p) => p.isHome)!;
    return home.sections.find((s) => !site.pages.find((p) => p.isHome)!.sections.some((o) => o.id === s.id));
  };

  it('modo básico crea las secciones nuevas con ids en sus listas', () => {
    for (const [text, type] of [
      ['Agrega una sección de preguntas frecuentes', 'faq'],
      ['Agrega una sección de planes', 'pricing'],
      ['Agrega una sección con cifras', 'stats'],
      ['Agrega una sección de nuestro equipo', 'team'],
      ['Agrega una sección de logos de aliados', 'logos'],
      ['Agrega una sección de video', 'video'],
    ] as const) {
      const { plan } = ask(text);
      const added = lastSection(plan);
      assert.equal(added?.type, type, text);
      const lists = Object.values(added!.content).filter(Array.isArray).flat() as { id?: string }[];
      for (const entry of lists) if (entry && typeof entry === 'object' && 'id' in entry) assert.ok(entry.id, `${type}: ítem sin id`);
    }
  });

  it('todas las secciones se crean con sus valores por defecto (schema estricto)', () => {
    for (const type of SECTION_TYPES) assert.doesNotThrow(() => createSection(type), type);
  });

  it('cambia a los layouts de producto nuevos', () => {
    const { actions } = ask('Muestra los productos en tabla comparativa');
    assert.ok(JSON.stringify(actions).includes('"comparison"'));
  });

  it('descuento y video', () => {
    assert.equal(discountPercent({ price: 80, compareAtPrice: 100 }), 20);
    assert.equal(discountPercent({ price: 100, compareAtPrice: 80 }), null);
    assert.equal(discountPercent({ price: null, compareAtPrice: 80 }), null);
    assert.equal(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')?.kind, 'youtube');
    assert.equal(parseVideoUrl('https://vimeo.com/76979871')?.kind, 'vimeo');
    assert.equal(parseVideoUrl('https://cdn.example.com/a.mp4')?.kind, 'file');
    assert.equal(parseVideoUrl('javascript:alert(1)'), null);
    const p = presentation({ layout: 'minimal' });
    assert.equal(p.fields.compareAt, true);
    assert.equal(p.fields.discount, false);
  });
});
