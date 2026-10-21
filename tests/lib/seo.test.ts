import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogSitemapEntries } from '@/lib/catalog/sitemap';
import { itemJsonLd } from '@/lib/catalog/structured-data';
import { buildSampleSite } from '@/lib/site/sample-site';
import { buildHeaderProps } from '@/site-renderer/chrome';
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

  it('omite las fichas de ítems en categorías ocultas o borradas (en el sitio dan 404); sin categoría, sí van', () => {
    const withCategories = {
      ...data,
      categories: [
        { id: 'cat-on', is_active: true, deleted_at: null },
        { id: 'cat-off', is_active: false, deleted_at: null },
        { id: 'cat-gone', is_active: true, deleted_at: day },
      ],
      items: [
        { catalog_id: 'c1', slug: 'latte', updated_at: day, category_id: 'cat-on' },
        { catalog_id: 'c1', slug: 'oculto', updated_at: day, category_id: 'cat-off' },
        { catalog_id: 'c1', slug: 'borrado', updated_at: day, category_id: 'cat-gone' },
        { catalog_id: 'c1', slug: 'suelto', updated_at: day, category_id: null },
      ],
    };
    const urls = catalogSitemapEntries(withCategories).map((e) => e.url.replace(/^https?:\/\/[^/]+/, ''));
    assert.deepEqual(urls, ['/catalogo/cafe', '/catalogo/cafe/menu', '/catalogo/cafe/p/latte', '/catalogo/cafe/p/suelto']);
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

  it('con reseñas aprobadas: calificación promedio y las reseñas; sin reseñas activas, nada', () => {
    const latte = site.items.find((i) => i.name === 'Latte de avena')!;
    const [product] = itemJsonLd(site, latte) as unknown as [{ aggregateRating: Record<string, unknown>; review: { author: { name: string }; reviewRating: { ratingValue: number }; datePublished: string }[] }];
    assert.deepEqual(product.aggregateRating, { '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 2, bestRating: 5, worstRating: 1 });
    assert.deepEqual(product.review.map((r) => [r.author.name, r.reviewRating.ratingValue, r.datePublished]), [['Luis R.', 5, '2026-10-10'], ['Sofía P.', 4, '2026-10-05']]);
    const off = { ...site, settings: { ...site.settings, reviews: { enabled: false } } };
    const [plain] = itemJsonLd(off, latte) as unknown as [Record<string, unknown>];
    assert.equal(plain.aggregateRating, undefined);
    const coldBrew = site.items.find((i) => i.name === 'Cold brew')!;
    assert.equal((itemJsonLd(site, coldBrew)[0] as Record<string, unknown>).aggregateRating, undefined);
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

describe('Ventana de bienvenida', () => {
  const site = buildSampleSite();
  const withPopup = { ...site, theme: { ...site.theme, popup: { ...site.theme.popup, enabled: true, title: '¡Bienvenido!', text: '10 % en tu primer pedido', code: 'BIENVENIDA', delay: 0 } } };
  const env = { mode: 'public' as const, basePath: '/demo', currentPageId: null };

  it('sólo con título, en el sitio publicado (no en la vista previa); cambia de clave si cambia el contenido', () => {
    assert.equal(buildHeaderProps(site, env).popup, null);
    const props = buildHeaderProps(withPopup, env).popup!;
    assert.deepEqual([props.title, props.code, props.button], ['¡Bienvenido!', 'BIENVENIDA', null]);
    assert.equal(buildHeaderProps(withPopup, { ...env, mode: 'preview' }).popup, null);
    const changed = buildHeaderProps({ ...withPopup, theme: { ...withPopup.theme, popup: { ...withPopup.theme.popup, code: 'OTRO' } } }, env).popup!;
    assert.notEqual(changed.storageKey, props.storageKey);
    const linked = buildHeaderProps({ ...withPopup, theme: { ...withPopup.theme, popup: { ...withPopup.theme.popup, link: { ...withPopup.theme.popup.link, kind: 'whatsapp' } } } }, env).popup!;
    assert.match(linked.button!.href, /^https:\/\/wa\.me\//);
    assert.equal(linked.button!.label, 'Ver más');
  });
});
