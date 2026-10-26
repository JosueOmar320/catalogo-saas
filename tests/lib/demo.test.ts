import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoHoursLeft } from '@/lib/demo/expiry';
import { buildDemoSeed, demoPhotoIds, type DemoImage } from '@/lib/demo/seed';
import { buildSamplePages, SAMPLE_ITEMS } from '@/lib/site/sample-site';

const BUSINESS = '11111111-1111-4111-8111-111111111111';
const CATALOG = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-26T18:00:00Z');

let counter = 0;
const uuid = () => `00000000-0000-4000-9000-${String(++counter).padStart(12, '0')}`;
const images = Object.fromEntries(
  demoPhotoIds().map((photo, i): [string, DemoImage] => [photo, { path: `${BUSINESS}/media/p${i}.jpg`, thumbPath: `${BUSINESS}/media/p${i}-thumb.jpg`, width: 1200, height: 800, size: 90_000, mime: 'image/jpeg' }]),
);
const seed = (overrides: Partial<Parameters<typeof buildDemoSeed>[0]> = {}) => buildDemoSeed({ businessId: BUSINESS, catalogId: CATALOG, ownerId: OWNER, now: NOW, images, uuid, ...overrides });

describe('Cuenta demo: contenido sembrado', () => {
  const data = seed();

  it('todas las filas son del negocio de prueba y los ids son nuevos', () => {
    for (const rows of [data.categories, data.items, data.itemImages, data.media, data.pages, data.reviews, data.orders, data.siteViews, data.funnel, data.orderStats]) {
      assert.ok(rows.length > 0);
      assert.ok(rows.every((row) => row.business_id === BUSINESS));
    }
    const ids = [...data.categories, ...data.items, ...data.pages].map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);
    // Ningún id fijo del sitio /demo (se repetirían entre negocios de prueba): las filas y sus referencias.
    assert.ok(ids.every((id) => !id!.startsWith('00000000-0000-4000-8000-')));
    assert.ok(!JSON.stringify(data.items).includes('00000000-0000-4000-8000-'));
    assert.ok(!JSON.stringify(data.pages.map((p) => p.sections)).match(/"pageId":"00000000-0000-4000-8000-/));
  });

  it('los productos llevan sus opciones, extras y «Combínalo con» apuntando a los productos nuevos', () => {
    const latte = data.items[1];
    const attributes = latte.attributes as { variants: { options: { name: string }[] }; extras: { options: unknown[] }; pairings: string[]; values: Record<string, unknown> };
    assert.deepEqual(attributes.variants.options.map((o) => o.name), ['12 oz', '16 oz']);
    assert.equal(attributes.extras.options.length, 3);
    assert.deepEqual(attributes.pairings, [data.items[4].id, data.items[5].id]);
    assert.equal(attributes.values.origen, 'Veracruz');
    assert.equal(data.items[1].category_id, data.categories[0].id);
  });

  it('fotos: cada una copiada una vez en la biblioteca; sin copia, el producto queda sin imagen', () => {
    const copied = data.media.filter((m) => m.storage_provider === 'supabase');
    assert.equal(new Set(copied.map((m) => m.path)).size, copied.length);
    assert.equal(data.itemImages.length, SAMPLE_ITEMS.filter((i) => i.photo).length);
    const without = seed({ images: {} });
    assert.equal(without.itemImages.length, 0);
    assert.ok(without.categories.every((c) => c.image_path === null));
  });

  it('las fotos de las secciones quedan registradas como enlaces externos (el editor las acepta al guardar)', () => {
    const external = data.media.filter((m) => m.storage_provider === 'external');
    assert.ok(external.length >= 5);
    assert.ok(external.every((m) => m.path.startsWith('https://images.unsplash.com/') && m.public_url === m.path));
    const sections = JSON.stringify(data.pages.map((p) => p.sections));
    assert.ok(external.every((m) => sections.includes(m.path)));
  });

  it('páginas: los enlaces entre páginas y el menú usan los ids nuevos', () => {
    const ids = new Set(data.pages.map((p) => p.id));
    const menu = data.pages.find((p) => p.slug === 'menu')!;
    assert.ok(JSON.stringify(data.pages[0].sections).includes(menu.id!));
    const nav = data.navigation as { items: { kind: string; pageId: string }[] };
    const linked = nav.items.flatMap((i) => (i.kind === 'page' ? [i.pageId] : []));
    assert.ok(linked.length >= 4 && linked.every((id) => ids.has(id)));
    assert.equal(data.pages.length, buildSamplePages().length);
  });

  it('pedidos válidos para la base: folios únicos, teléfonos y totales coherentes', () => {
    assert.equal(new Set(data.orders.map((o) => o.reference)).size, data.orders.length);
    for (const order of data.orders) {
      assert.match(order.reference, /^[A-Z0-9]{4,8}$/);
      assert.match(order.customer_phone!, /^\+?[0-9]{8,15}$/);
      const subtotal = order.lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);
      assert.equal(order.subtotal, subtotal);
      assert.equal(order.total, subtotal + (order.delivery_fee ?? 0));
      assert.ok(Date.parse(order.created_at!) <= NOW.getTime(), 'ningún pedido en el futuro');
      assert.ok(order.lines.every((line) => data.items.some((item) => item.id === line.itemId)));
    }
    // Mayoreo: 12 croissants a $38 c/u.
    assert.ok(data.orders.some((o) => o.lines.some((l) => l.name === 'Croissant de mantequilla' && l.qty === 12 && l.unitPrice === 38)));
    assert.deepEqual([...new Set(data.orders.map((o) => o.status))].sort(), ['cancelled', 'confirmed', 'delivered', 'new', 'ready']);
  });

  it('reseñas: aprobadas con respuesta y una pendiente por revisar', () => {
    assert.equal(data.reviews.filter((r) => r.status === 'pending').length, 1);
    assert.ok(data.reviews.some((r) => r.reply));
  });

  it('60 días de estadísticas (hay periodo anterior), iguales con la misma semilla', () => {
    assert.equal(data.siteViews.length, 60);
    assert.equal(data.siteViews.at(-1)!.day, '2026-10-26');
    assert.ok(data.funnel.every((f) => (f.sessions ?? 0) >= (f.viewed_product ?? 0) && (f.viewed_product ?? 0) >= (f.started_cart ?? 0) && (f.started_cart ?? 0) >= (f.sent_order ?? 0)));
    counter = 0;
    const again = JSON.stringify(seed().funnel);
    counter = 0;
    assert.equal(JSON.stringify(seed().funnel), again);
  });

  it('horas que le quedan a la cuenta de prueba', () => {
    const now = Date.parse('2026-10-26T18:00:00Z');
    assert.equal(demoHoursLeft('2026-10-27T17:30:00Z', now), 23);
    assert.equal(demoHoursLeft('2026-10-26T18:40:00Z', now), 0);
    assert.equal(demoHoursLeft('2026-10-26T10:00:00Z', now), 0);
  });
});
