import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseActions } from '@/lib/assistant/actions';
import { LAYOUT_OPTIONS, presentation } from '@/lib/catalog/presentation';
import { embedDocument } from '@/lib/site/custom-code';
import { clampEmbedHeight, hasOwnChrome } from '@/lib/site/custom-code-config';
import { resolveSpotlightItem } from '@/lib/site/resolve';
import { buildSampleSite } from '@/lib/site/sample-site';
import { createSection, sectionSchemas } from '@/lib/site/section-schemas';

describe('Sección Producto', () => {
  const site = buildSampleSite();

  it('nace en automático (el primer destacado) con ficha, galería y botón para pedir', () => {
    const section = createSection('product');
    assert.equal(section.content.itemId, '');
    assert.equal(section.content.layout, 'split');
    assert.ok(section.content.gallery && section.content.showOrder && section.content.showDetailsLink);
    assert.equal(resolveSpotlightItem(section.content, site.items)?.id, site.items.find((i) => i.isFeatured)?.id);
    // Sin destacados: el primero del catálogo; sin ítems, nada.
    assert.equal(resolveSpotlightItem({ itemId: '' }, site.items.map((i) => ({ ...i, isFeatured: false })))?.id, site.items[0].id);
    assert.equal(resolveSpotlightItem({ itemId: '' }, []), null);
  });

  it('el elegido, o nada si ya no existe; el id debe ser válido', () => {
    const chosen = site.items[2];
    assert.equal(resolveSpotlightItem({ itemId: chosen.id }, site.items)?.id, chosen.id);
    assert.equal(resolveSpotlightItem({ itemId: '00000000-0000-4000-8000-00000000dead' }, site.items), null);
    const section = createSection('product', { itemId: chosen.id, layout: 'banner', imageSide: 'right' });
    assert.ok(!sectionSchemas.product.safeParse({ ...section, content: { ...section.content, itemId: 'Espresso' } }).success);
    assert.ok(!sectionSchemas.product.safeParse({ ...section, content: { ...section.content, layout: 'grid' } }).success);
  });

  it('Garfield la puede crear', () => {
    const { errors } = parseActions([{ action: 'create_section', section: { type: 'product', content: { eyebrow: 'Producto del mes', layout: 'card' } } }]);
    assert.deepEqual(errors, []);
  });
});

describe('Tarjetas de servicio', () => {
  it('es una presentación más, con columnas, tamaño de imagen y estilo de tarjeta', () => {
    const p = presentation({ layout: 'serviceCards' });
    assert.equal(p.layout, 'serviceCards');
    for (const option of ['columns', 'imageSize', 'cardStyle', 'align'] as const) assert.ok(LAYOUT_OPTIONS.serviceCards.includes(option));
    const services = createSection('services', { presentation: { layout: 'serviceCards' } });
    assert.equal(services.content.presentation.layout, 'serviceCards');
  });
});

describe('Widget en línea', () => {
  it('con alto automático simula la ventana visible: 100vh, lo fijo, el scroll y las anclas', () => {
    const inline = embedDocument('<!doctype html><html><head></head><body><div class="min-h-screen"></div></body></html>', {}, { inline: true });
    assert.match(inline, /<script data-mode="inline">/);
    assert.match(inline, /vitrina:embed-viewport/);
    assert.match(inline, /vitrina:embed-scroll/);
    assert.match(inline, /calc\('\+n\+' \* var\(--vitrina-vh\)\)/);
    assert.match(inline, /data-vitrina-viewport/);
    assert.match(inline, /window\.IntersectionObserver=/);
    // Sólo desplaza la página del sitio justo después de un clic en el widget.
    assert.match(inline, /navigator\.userActivation\.isActive/);
    // Sin modo en línea (pantalla completa o alto fijo): la versión de siempre, con su propio scroll.
    const own = embedDocument('<p>x</p>');
    assert.doesNotMatch(own, /data-mode="inline"/);
    assert.ok(own.indexOf('if(!inline){') < own.indexOf('getBoundingClientRect=function'));
  });

  it('acepta páginas largas y reconoce las que traen su propio menú o pie', () => {
    assert.equal(clampEmbedHeight(9000), 9000);
    assert.equal(clampEmbedHeight(99_999), 30_000);
    assert.ok(hasOwnChrome('<nav class="fixed">…</nav>'));
    assert.ok(hasOwnChrome('<footer>© 2026</footer>'));
    assert.ok(!hasOwnChrome('<section id="inicio"><h1>Hola</h1></section>'));
  });
});
