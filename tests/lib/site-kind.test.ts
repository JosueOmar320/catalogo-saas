import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createBusinessSchema } from '@/features/admin/schema';
import { areasFor, matchAreas } from '@/lib/assistant/panel-guide';
import { isCatalogOnlyPath, parseSiteKind } from '@/lib/business/site-kind';
import { SECTION_META } from '@/lib/site/section-registry';
import { buildStarterSite } from '@/lib/site/starter';

describe('Tipo de sitio', () => {
  it('lo de fábrica es un negocio con catálogo', () => {
    assert.equal(parseSiteKind(undefined), 'catalog');
    assert.equal(parseSiteKind('tienda'), 'catalog');
    assert.equal(parseSiteKind('website'), 'website');
    assert.equal(createBusinessSchema.parse({ name: 'Mi negocio', slug: 'mi-negocio' }).siteKind, 'catalog');
  });

  // El menú (íconos de React) se prueba en el E2E con sesión.
  it('las rutas del catálogo se reconocen (también las internas)', () => {
    assert.ok(isCatalogOnlyPath('/dashboard/catalog/items/new'));
    assert.ok(isCatalogOnlyPath('/dashboard/pedidos'));
    assert.ok(!isCatalogOnlyPath('/dashboard/catalogo'));
    assert.ok(!isCatalogOnlyPath('/dashboard/sitio'));
  });

  it('el sitio inicial de un sitio web no tiene secciones de productos', () => {
    const { pages, navigation } = buildStarterSite('website');
    assert.deepEqual(pages.map((p) => p.title), ['Inicio', 'Nosotros', 'Contacto']);
    assert.equal(navigation.items.length, 3);
    const types = pages.flatMap((p) => p.sections.map((s) => s.type));
    assert.ok(types.every((type) => SECTION_META[type].group !== 'Catálogo'), types.join());
    // Los botones llevan a páginas que existen.
    const hero = pages[0].sections.find((s) => s.type === 'hero')!;
    const ids = new Set(pages.map((p) => p.id));
    assert.ok(hero.type === 'hero' && ids.has(hero.content.primaryButton.link.pageId) && ids.has(hero.content.secondaryButton.link.pageId));
  });

  it('la ayuda de Garfield en un sitio web no ofrece áreas del catálogo', () => {
    const ids = areasFor(false, false).map((a) => a.id);
    assert.ok(!ids.some((id) => ['products', 'orders', 'reviews', 'pdf', 'categories'].includes(id)), ids.join());
    assert.ok(ids.includes('site'));
    assert.equal(matchAreas('¿Cómo publico mi sitio?', false, 3, false)[0].id, 'settings_publishing');
    assert.ok(!matchAreas('ver mis pedidos', false, 3, false).some((a) => a.id === 'orders'));
    assert.equal(matchAreas('ver mis pedidos')[0].id, 'orders');
  });
});
