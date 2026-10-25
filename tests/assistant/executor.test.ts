import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseActions, type AssistantAction } from '@/lib/assistant/actions';
import type { BuilderState } from '@/features/builder/reducer';
import { planAssistantActions } from '@/features/assistant/executor';
import { MAX_SITE_PAGES } from '@/features/builder/schema';
import { pageSchema } from '@/lib/site/pages';
import { buildSampleSite } from '@/lib/site/sample-site';
import { themeSchema } from '@/lib/design/theme';

/** Borrador del builder con el sitio de ejemplo (Inicio, Menú, Eventos, Nosotros, Contacto). */
function sampleState(): BuilderState {
  const site = buildSampleSite();
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

const actions = (list: unknown[]): AssistantAction[] => {
  const { actions: parsed, errors } = parseActions(list);
  assert.deepEqual(errors, []);
  return parsed;
};
const page = (state: BuilderState, id = state.selectedPageId) => state.pages.find((p) => p.id === id)!;
/** Todo resultado debe pasar las validaciones estrictas que usa saveSite. */
const assertSavable = (state: BuilderState) => {
  for (const p of state.pages) assert.ok(pageSchema.safeParse(p).success, `página ${p.title} inválida`);
  assert.ok(themeSchema.safeParse(state.theme).success);
};

describe('Garfield AI · ejecutor de acciones', () => {
  it('agrega una sección de productos destacados debajo de la seleccionada (con 4 por fila)', () => {
    const s = sampleState();
    const home = page(s);
    const selected = home.sections[1];
    const plan = planAssistantActions({ ...s, selectedSectionId: selected.id }, actions([
      { action: 'create_section', section: { type: 'products', content: { title: 'Productos destacados', collection: { source: 'featured' }, presentation: { columns: { desktop: 4 } } } } },
    ]));
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const sections = page(plan.next, home.id).sections;
    const index = sections.findIndex((x) => x.id === selected.id);
    const created = sections[index + 1];
    assert.equal(created.type, 'products');
    assert.equal(created.type === 'products' && created.content.collection.source, 'featured');
    assert.equal(created.type === 'products' && created.content.presentation.columns.desktop, 4);
    assert.equal(plan.autoApply, true);
    assert.equal(plan.next.selectedSectionId, created.id);
    assertSavable(plan.next);
  });

  it('cambia columnas y tamaño de imagen de "esta sección"', () => {
    const s = sampleState();
    const products = page(s).sections.find((x) => x.type === 'products')!;
    const plan = planAssistantActions({ ...s, selectedSectionId: products.id }, actions([
      { action: 'update_product_display', section: 'selected', presentation: { columns: { desktop: 3 }, imageSize: 'lg', layout: 'largeCards' } },
    ]));
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const updated = page(plan.next).sections.find((x) => x.id === products.id)!;
    assert.ok(updated.type === 'products');
    assert.equal(updated.content.presentation.layout, 'largeCards');
    assert.equal(updated.content.presentation.columns.desktop, 3);
    // El merge es profundo: tablet y móvil se conservan.
    assert.equal(updated.content.presentation.columns.mobile, products.type === 'products' ? products.content.presentation.columns.mobile : 0);
  });

  it('mueve una sección arriba de "la de productos"', () => {
    const s = sampleState();
    const home = page(s);
    const contact = home.sections.find((x) => x.type === 'contact')!;
    const plan = planAssistantActions({ ...s, selectedSectionId: contact.id }, actions([{ action: 'move_section', section: 'selected', position: { before: 'type:products' } }]));
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const types = page(plan.next, home.id).sections.map((x) => x.type);
    assert.equal(types.indexOf('contact') + 1, types.indexOf('products'));
  });

  it('crea una página de servicios completa desde un blueprint y la agrega al menú', () => {
    const s = sampleState();
    const plan = planAssistantActions(s, actions([{ action: 'create_page', title: 'Servicios de limpieza', blueprint: 'services', topic: 'limpieza de oficinas' }]));
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const created = plan.next.pages.at(-1)!;
    assert.equal(created.slug, 'servicios-de-limpieza');
    assert.deepEqual(created.sections.map((x) => x.type), ['hero', 'text', 'services', 'features', 'banner', 'contact']);
    assert.ok(plan.next.navigation.items.some((i) => i.pageId === created.id));
    assert.equal(plan.next.selectedPageId, created.id);
    assert.equal(plan.autoApply, false, 'crear una página se muestra como plan');
    assertSavable(plan.next);
  });

  it('no crea más páginas que el máximo del sitio (el servidor lo rechazaría al guardar)', () => {
    const s = sampleState();
    const extra = Array.from({ length: MAX_SITE_PAGES - s.pages.length }, (_, i) => ({ ...s.pages[1], id: `00000000-0000-4000-8000-0000000009${String(i).padStart(2, '0')}`, slug: `extra-${i}`, isHome: false }));
    const full = { ...s, pages: [...s.pages, ...extra] };
    assert.equal(full.pages.length, MAX_SITE_PAGES);
    const plan = planAssistantActions(full, actions([{ action: 'create_page', title: 'Una más', blueprint: 'services' }]));
    assert.equal(plan.next.pages.length, MAX_SITE_PAGES);
    assert.notEqual(plan.steps[0].status, 'ok');
    assert.match(plan.steps[0].error ?? '', /máximo de 30 páginas/);
    // Con una menos, sí.
    const almost = { ...full, pages: full.pages.slice(0, -1) };
    assert.equal(planAssistantActions(almost, actions([{ action: 'create_page', title: 'Una más', blueprint: 'services' }])).next.pages.length, MAX_SITE_PAGES);
  });

  it('crea una página con secciones propias, alias y un botón que enlaza a otra página por referencia', () => {
    const s = sampleState();
    const plan = planAssistantActions(s, actions([
      {
        action: 'create_page',
        title: 'Tienda de ropa',
        as: '$tienda',
        sections: [
          { type: 'hero', content: { title: 'Nueva temporada', primaryButton: { label: 'Ver menú', link: { kind: 'page', pageId: 'menu' } } } },
          { type: 'categories', content: { title: 'Categorías' } },
          { type: 'products', content: { title: 'Destacados', collection: { source: 'featured' } }, as: '$dest' },
          { type: 'catalog', content: { title: 'Todos los productos' } },
          { type: 'features', content: { title: 'Beneficios', items: [{ icon: 'truck', title: 'Envíos', text: 'A todo el país' }] } },
        ],
      },
      { action: 'update_section', section: '$dest', content: { subtitle: 'Lo que más se vende' } },
      { action: 'set_home_page', page: '$tienda' },
    ]));
    assert.deepEqual(plan.steps.map((x) => x.status), ['ok', 'ok', 'ok'], plan.steps.map((x) => x.error).join(' | '));
    const created = plan.next.pages.find((p) => p.title === 'Tienda de ropa')!;
    const menu = plan.next.pages.find((p) => p.slug === 'menu')!;
    const hero = created.sections[0];
    assert.ok(hero.type === 'hero');
    assert.equal(hero.content.primaryButton.link.pageId, menu.id);
    const features = created.sections.find((x) => x.type === 'features');
    assert.ok(features?.type === 'features' && features.content.items[0].id, 'los ítems reciben id');
    assert.ok(created.isHome);
    assert.equal(plan.needsConfirmation, true, 'cambiar la página de inicio pide confirmación');
    assertSavable(plan.next);
  });

  it('pide confirmación para eliminar y no aplica automáticamente', () => {
    const s = sampleState();
    const plan = planAssistantActions(s, actions([{ action: 'delete_section', section: 'type:testimonials' }]));
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    assert.equal(plan.steps[0].risk, 'confirm');
    assert.equal(plan.needsConfirmation, true);
    assert.equal(plan.autoApply, false);
    assert.ok(!page(plan.next).sections.some((x) => x.type === 'testimonials'));
  });

  it('cambia el diseño: encabezado elegante, fondo claro y preset (con confirmación)', () => {
    const s = sampleState();
    const simple = planAssistantActions(s, actions([
      { action: 'update_theme', header: { style: 'elegant' } },
      { action: 'update_background', target: 'site', background: { type: 'color', color: '#FAF8F5' } },
    ]));
    assert.deepEqual(simple.steps.map((x) => x.status), ['ok', 'ok']);
    assert.equal(simple.next.theme.header.style, 'elegant');
    assert.equal(simple.next.theme.background.type, 'color');
    assert.equal(simple.next.theme.background.color, '#FAF8F5');
    assert.equal(simple.autoApply, true);
    const preset = planAssistantActions(s, actions([{ action: 'update_theme', preset: 'modern' }]));
    assert.equal(preset.next.theme.preset, 'modern');
    assert.equal(preset.needsConfirmation, true);
  });

  it('rechaza valores inválidos sin romper el resto del plan', () => {
    const s = sampleState();
    const plan = planAssistantActions(s, actions([
      { action: 'update_theme', colors: { primary: 'rojo' } },
      { action: 'update_section', section: 'no-existe', content: { title: 'x' } },
      { action: 'update_product_display', section: 'type:products', presentation: { columns: { desktop: 9 } } },
      { action: 'create_section', section: { type: 'contact' }, position: { place: 'end' } },
    ]));
    assert.deepEqual(plan.steps.map((x) => x.status), ['error', 'error', 'error', 'ok']);
    assert.match(plan.steps[0].error!, /colors\.primary/);
    assert.equal(plan.next.theme.colors.primary, s.theme.colors.primary);
    assert.equal(page(plan.next).sections.at(-1)!.type, 'contact');
  });

  it('no permite imágenes que el sitio no tiene (la IA no puede inventar archivos)', () => {
    const s = sampleState();
    const plan = planAssistantActions(s, actions([
      { action: 'create_section', section: { type: 'text', content: { title: 'Hola', image: { path: 'otro-negocio/robada.jpg' }, imagePosition: 'right' } } },
      { action: 'create_section', section: { type: 'gallery', content: { images: [{ path: 'x/y.jpg', caption: 'no' }] } } },
    ]));
    const [text, gallery] = page(plan.next).sections.filter((x) => x.type === 'text' || x.type === 'gallery').slice(-2);
    assert.ok(text.type === 'text' && text.content.image.path === null);
    assert.ok(gallery.type === 'gallery' && gallery.content.images.length === 0);
  });

  it('duplica "esta sección" con contenido nuevo y entiende "la anterior"', () => {
    const s = sampleState();
    const hero = page(s).sections[0];
    const plan = planAssistantActions({ ...s, selectedSectionId: hero.id }, actions([
      { action: 'duplicate_section', section: 'selected', content: { title: 'Segunda portada' } },
      { action: 'move_section', section: 'last', position: { place: 'end' } },
    ]));
    assert.deepEqual(plan.steps.map((x) => x.status), ['ok', 'ok'], plan.steps.map((x) => x.error).join(' | '));
    const last = page(plan.next).sections.at(-1)!;
    assert.ok(last.type === 'hero' && last.content.title === 'Segunda portada');
  });

  it('gestiona la navegación: agregar, ocultar, reordenar y quitar', () => {
    const s = sampleState();
    const plan = planAssistantActions(s, actions([
      { action: 'add_nav_item', kind: 'url', label: 'Blog', url: 'https://blog.example.com' },
      { action: 'update_nav_item', item: 'page:eventos', visible: false },
      { action: 'reorder_navigation', order: ['page:contacto'] },
      { action: 'remove_nav_item', item: 'Blog' },
    ]));
    assert.deepEqual(plan.steps.map((x) => x.status), ['ok', 'ok', 'ok', 'ok'], plan.steps.map((x) => x.error).join(' | '));
    const contact = plan.next.pages.find((p) => p.slug === 'contacto')!;
    assert.equal(plan.next.navigation.items[0].pageId, contact.id);
    assert.ok(!plan.next.navigation.items.some((i) => i.label === 'Blog'));
    assert.equal(plan.needsConfirmation, true);
  });

  it('el modelo no puede usar acciones fuera del catálogo', () => {
    const { actions: parsed, errors } = parseActions([{ action: 'drop_database' }, { action: 'run_sql', sql: 'delete' }, { action: 'focus', page: 'current' }]);
    assert.equal(parsed.length, 1);
    assert.equal(errors.length, 2);
  });
});

describe('Garfield AI · contrato con el modelo', () => {
  it('el JSON Schema de la herramienta se genera del mismo schema Zod y es un objeto', async () => {
    const { z } = await import('zod');
    const { assistantResponseSchema } = await import('@/lib/assistant/actions');
    const schema = z.toJSONSchema(assistantResponseSchema, { io: 'input', unrepresentable: 'any' }) as { type: string; properties: Record<string, unknown>; required: string[] };
    assert.equal(schema.type, 'object');
    assert.deepEqual(Object.keys(schema.properties).sort(), ['actions', 'message', 'suggestions']);
  });

  it('la guía de capacidades se genera desde los registros e incluye todos los tipos de sección', async () => {
    const { capabilitiesGuide } = await import('@/lib/assistant/capabilities');
    const { SECTION_TYPES } = await import('@/lib/site/section-schemas');
    const guide = capabilitiesGuide();
    for (const type of SECTION_TYPES) assert.ok(guide.includes(`### ${type} —`), type);
    assert.ok(guide.length < 40_000, `guía demasiado larga: ${guide.length}`);
  });
});

describe('Garfield AI · imágenes y catálogo', () => {
  const BIZ = '11111111-2222-4333-8444-555555555555';
  const IMG = `${BIZ}/site/fondo.jpg`;

  it('"pon esta imagen como fondo del hero": imagen de la biblioteca con overlay y texto claro', () => {
    const s = sampleState();
    const hero = page(s).sections.find((x) => x.type === 'hero')!;
    const plan = planAssistantActions({ ...s, selectedSectionId: hero.id }, actions([{ action: 'set_image', section: 'selected', path: IMG }]), { allowedMedia: [IMG] });
    assert.equal(plan.steps[0].status, 'ok', plan.steps[0].error);
    const updated = page(plan.next).sections.find((x) => x.id === hero.id)!;
    assert.equal(updated.style.background.type, 'image');
    assert.equal(updated.style.background.image.path, IMG);
    assert.equal(updated.style.background.overlay.opacity, 45);
    assert.equal(updated.style.textColor, 'light');
    assertSavable(plan.next);
  });

  it('no usa imágenes que el servidor no validó', () => {
    const s = sampleState();
    const plan = planAssistantActions(s, actions([{ action: 'set_image', section: 'type:hero', path: IMG }]));
    assert.equal(plan.steps[0].status, 'error');
    assert.match(plan.steps[0].error!, /biblioteca/);
  });

  it('texto: la imagen va al lado; galería: agrega, reordena y quita', () => {
    const s = sampleState();
    const other = `${BIZ}/site/otra.jpg`;
    const plan = planAssistantActions(
      s,
      actions([
        { action: 'create_section', section: { type: 'text', content: { title: 'Historia' }, as: '$t' } },
        { action: 'set_image', section: '$t', path: IMG },
        { action: 'create_section', section: { type: 'gallery', content: { title: 'Fotos' }, as: '$g' } },
        { action: 'add_gallery_images', section: '$g', images: [{ path: IMG, caption: 'Salón' }, { path: other }] },
        { action: 'reorder_gallery', section: '$g', order: [other] },
        { action: 'remove_gallery_images', section: '$g', paths: [IMG] },
      ]),
      { allowedMedia: [IMG, other] },
    );
    assert.deepEqual(plan.steps.map((x) => x.status), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'], plan.steps.map((x) => x.error).join(' | '));
    const sections = page(plan.next).sections;
    const text = sections.find((x) => x.type === 'text' && x.content.title === 'Historia')!;
    assert.ok(text.type === 'text' && text.content.image.path === IMG && text.content.imagePosition === 'right');
    const gallery = sections.find((x) => x.type === 'gallery' && x.content.title === 'Fotos')!;
    assert.ok(gallery.type === 'gallery');
    assert.deepEqual(gallery.content.images.map((i) => i.path), [other]);
  });

  it('acciones de catálogo: no tocan el borrador, piden aplicar y se enlazan por $alias', () => {
    const s = sampleState();
    const plan = planAssistantActions(
      s,
      actions([
        { action: 'create_category', name: 'Bebidas frías', as: '$frias' },
        { action: 'create_product', name: 'Frappé', category: '$frias', price: 65, featured: true },
        { action: 'create_section', section: { type: 'products', content: { title: 'Bebidas frías', collection: { source: 'category', categoryId: '$frias' } } } },
      ]),
    );
    assert.deepEqual(plan.steps.map((x) => x.kind), ['catalog', 'catalog', 'editor']);
    assert.equal(plan.hasCatalogChanges, true);
    assert.equal(plan.autoApply, false);
    const section = page(plan.next).sections.find((x) => x.type === 'products' && x.content.title === 'Bebidas frías')!;
    // En la vista previa el $alias aún no existe: la sección queda sin filtro.
    assert.ok(section.type === 'products' && section.content.collection.categoryId === '');
  });

  it('entiende categorías y productos por su nombre', () => {
    const s = sampleState();
    const site = buildSampleSite();
    const category = site.categories[0];
    const items = site.items.slice(0, 2);
    const plan = planAssistantActions(
      s,
      actions([
        { action: 'create_section', section: { type: 'products', content: { collection: { source: 'category', categoryId: category.name } } } },
        { action: 'create_section', section: { type: 'products', content: { collection: { source: 'manual', itemIds: items.map((i) => i.name) } } } },
      ]),
      { categories: site.categories, items: site.items },
    );
    const [byCategory, manual] = page(plan.next).sections.filter((x) => x.type === 'products').slice(-2);
    assert.ok(byCategory.type === 'products' && byCategory.content.collection.categoryId === category.id);
    assert.ok(manual.type === 'products');
    assert.deepEqual(manual.content.collection.itemIds, items.map((i) => i.id));
  });

  it('la sección Producto entiende el producto por su nombre (y si no existe, queda en automático)', () => {
    const site = buildSampleSite();
    const item = site.items[1];
    const plan = planAssistantActions(
      sampleState(),
      actions([
        { action: 'create_section', section: { type: 'product', content: { itemId: item.name, layout: 'card' } } },
        { action: 'create_section', section: { type: 'product', content: { itemId: 'No existe' } } },
      ]),
      { categories: site.categories, items: site.items },
    );
    const [named, missing] = page(plan.next).sections.filter((x) => x.type === 'product');
    assert.ok(named.type === 'product' && named.content.itemId === item.id && named.content.layout === 'card');
    assert.ok(missing.type === 'product' && missing.content.itemId === '');
  });

  it('borrar productos pide confirmación', () => {
    const plan = planAssistantActions(sampleState(), actions([{ action: 'delete_product', product: 'Frappé' }]));
    assert.equal(plan.steps[0].risk, 'confirm');
    assert.equal(plan.needsConfirmation, true);
  });
});
