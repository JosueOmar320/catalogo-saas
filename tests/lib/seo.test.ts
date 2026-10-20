import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogSitemapEntries } from '@/lib/catalog/sitemap';
import { itemJsonLd } from '@/lib/catalog/structured-data';
import { buildSampleSite } from '@/lib/site/sample-site';
import { EMPTY_FILTERS, filterItems } from '@/site-renderer/filter';

describe('Sitemap de los catálogos publicados', () => {
  const day = '2026-10-19T00:00:00Z';
  const data = {
    businesses: [{ id: 'b1', slug: 'cafe' }, { id: 'b2', slug: 'oculto' }],
    catalogs: [
      { id: 'c1', business_id: 'b1', seo: {}, updated_at: day },
      { id: 'c2', business_id: 'b2', seo: { noindex: true }, updated_at: day },
      { id: 'c3', business_id: 'b-inactivo', seo: {}, updated_at: day },
    ],
    pages: [
      { catalog_id: 'c1', slug: 'inicio', is_home: true, seo: {}, updated_at: day },
      { catalog_id: 'c1', slug: 'menu', is_home: false, seo: {}, updated_at: day },
      { catalog_id: 'c1', slug: 'privada', is_home: false, seo: { noindex: true }, updated_at: day },
      { catalog_id: 'c2', slug: 'menu', is_home: false, seo: {}, updated_at: day },
    ],
    items: [
      { catalog_id: 'c1', slug: 'latte', updated_at: day },
      { catalog_id: 'c2', slug: 'nada', updated_at: day },
      { catalog_id: 'c3', slug: 'nada', updated_at: day },
    ],
  };

  it('incluye inicio, páginas y fichas; omite "no indexar", la página de inicio repetida y negocios inactivos', () => {
    const urls = catalogSitemapEntries(data).map((e) => e.url.replace(/^https?:\/\/[^/]+/, ''));
    assert.deepEqual(urls, ['/catalogo/cafe', '/catalogo/cafe/menu', '/catalogo/cafe/p/latte']);
  });

  it('respeta el máximo de URLs', () => {
    assert.equal(catalogSitemapEntries(data, 2).length, 2);
  });
});

describe('Datos estructurados de la ficha', () => {
  const site = buildSampleSite();

  it('con opciones: rango de precios (AggregateOffer)', () => {
    const latte = site.items.find((i) => i.name === 'Latte de avena')!;
    const [product] = itemJsonLd(site, latte) as unknown as [Record<string, unknown>];
    assert.deepEqual(product.offers, { '@type': 'AggregateOffer', lowPrice: 68, highPrice: 78, offerCount: 2, priceCurrency: 'MXN', availability: 'https://schema.org/InStock', url: latte.url });
  });

  it('oferta con fecha de fin y migas: catálogo › categoría (página del catálogo, filtrada) › producto', () => {
    const coldBrew = { ...site.items.find((i) => i.name === 'Cold brew')!, saleEndsOn: '2026-10-31' };
    const [product, crumbs] = itemJsonLd(site, coldBrew) as unknown as [Record<string, { priceValidUntil?: string }>, { itemListElement: { name: string; item: string; position: number }[] }];
    assert.equal(product.offers.priceValidUntil, '2026-10-31');
    const names = crumbs.itemListElement.map((c) => c.name);
    assert.deepEqual(names, ['Café Aurora', 'Café de especialidad', 'Cold brew']);
    assert.match(crumbs.itemListElement[1].item, /\/demo\/menu\?categoria=/);
    assert.deepEqual(crumbs.itemListElement.map((c) => c.position), [1, 2, 3]);
  });

  it('servicio sin precio: Service, sin ofertas', () => {
    const service = site.items.find((i) => i.name === 'Café para oficinas')!;
    const [data] = itemJsonLd(site, service) as unknown as [Record<string, unknown>];
    assert.equal(data['@type'], 'Service');
    assert.equal(data.offers, undefined);
  });
});

describe('Búsqueda del catálogo', () => {
  it('encuentra por opciones y extras, sin acentos', () => {
    const site = buildSampleSite();
    const names = (query: string) => filterItems(site.items, { ...EMPTY_FILTERS, query }).map((i) => i.name);
    assert.deepEqual(names('almendra'), ['Latte de avena']);
    assert.deepEqual(names('SHOT extra'), ['Latte de avena']);
  });
});
