import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HEADER_STYLES } from '@/lib/design/styles-registry';
import { DEFAULT_THEME, themeSchema } from '@/lib/design/theme';
import { CATALOG_BROWSE_LAYOUTS, CATALOG_CATEGORY_NAVS, createSection, sectionSchemas } from '@/lib/site/section-schemas';

describe('Header: más estilos y menú lateral', () => {
  it('por defecto, la barra de siempre (los sitios que ya existen no cambian)', () => {
    const h = DEFAULT_THEME.header;
    assert.equal(h.layout, 'horizontal');
    assert.equal(h.linkStyle, 'underline');
    assert.equal(h.mobileMenu, 'dropdown');
    assert.equal(h.hideOnScroll, false);
    assert.equal(h.fullWidth, false);
    // Un tema guardado antes de estas opciones se lee con los valores por defecto.
    const old = themeSchema.parse({ ...DEFAULT_THEME, header: { style: 'dark', sticky: true } });
    assert.equal(old.header.layout, 'horizontal');
    assert.equal(old.header.style, 'dark');
  });

  it('acepta el menú lateral y los estilos nuevos; rechaza valores inventados', () => {
    for (const style of ['floating', 'glass', 'brand'] as const) assert.ok(HEADER_STYLES.includes(style));
    const vertical = themeSchema.parse({ ...DEFAULT_THEME, header: { ...DEFAULT_THEME.header, layout: 'vertical', verticalWidth: 'wide', style: 'glass', linkStyle: 'pill', mobileMenu: 'fullscreen' } });
    assert.equal(vertical.header.layout, 'vertical');
    assert.equal(vertical.header.mobileMenu, 'fullscreen');
    assert.ok(!themeSchema.safeParse({ ...DEFAULT_THEME, header: { ...DEFAULT_THEME.header, layout: 'diagonal' } }).success);
  });
});

describe('Catálogo: cómo se recorre', () => {
  it('por defecto, la barra con píldoras que filtran (como antes)', () => {
    const catalog = createSection('catalog');
    assert.deepEqual(catalog.content.browse, { layout: 'bar', categoryNav: 'chips', categoryMode: 'filter', sticky: true, counts: false, viewSwitch: false });
  });

  it('columna lateral, panel, pestañas, fotos y menú de saltos', () => {
    assert.deepEqual([...CATALOG_BROWSE_LAYOUTS], ['bar', 'sidebar', 'drawer']);
    assert.deepEqual([...CATALOG_CATEGORY_NAVS], ['chips', 'tabs', 'select', 'images']);
    const menu = createSection('catalog', { browse: { layout: 'drawer', categoryNav: 'tabs', categoryMode: 'jump', counts: true, viewSwitch: true } });
    assert.equal(menu.content.browse.categoryMode, 'jump');
    assert.equal(menu.content.browse.sticky, true);
    assert.ok(!sectionSchemas.catalog.safeParse({ ...menu, content: { ...menu.content, browse: { ...menu.content.browse, layout: 'carousel' } } }).success);
  });
});
