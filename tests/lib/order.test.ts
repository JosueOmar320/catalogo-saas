import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { buildOrderMessage, clampQty, couponHash, findCoupon, isOrderingPaused, refreshLines, NO_CHOICES, NO_OPTIONS, orderTotal, orderWhatsappHref, summarizeOrder, type OrderLine, type OrderOptions, type OrderPricing, type PublicCoupon } from '@/site-renderer/order/message';
import { siteTranslator } from '@/site-renderer/site-i18n';
import { orderConfig } from '@/site-renderer/order/config';
import { buildSampleSite } from '@/lib/site/sample-site';
import { summarizeOrders, windowStart } from '@/lib/orders/stats';
import { ordersPer100Views, summarizeViews } from '@/lib/views/stats';

const pricing: OrderPricing = { currency: 'MXN', locale: 'es-MX', format: catalogSettingsSchema.parse({}).priceFormat };

const line = (overrides: Partial<OrderLine>): OrderLine => ({
  id: 'a',
  name: 'Croissant',
  sku: null,
  price: 48,
  priceLabel: '$48',
  currency: 'MXN',
  url: 'https://x.test/p/croissant',
  image: null,
  qty: 1,
  ...overrides,
});

describe('Pedido por WhatsApp', () => {
  it('está apagado por defecto y conserva el saludo de fábrica', () => {
    const { order } = catalogSettingsSchema.parse({});
    assert.equal(order.enabled, false);
    assert.equal(order.intro, 'Hola {negocio}, quiero hacer este pedido:');
  });

  it('suma cantidades × precio y redondea a centavos', () => {
    const total = orderTotal([line({ qty: 2 }), line({ id: 'b', price: 0.1, qty: 3 })], pricing);
    assert.deepEqual(total, { value: 96.3, partial: false });
  });

  it('marca el total como parcial si hay productos sin precio o en otra moneda', () => {
    assert.deepEqual(orderTotal([line({ qty: 2 }), line({ id: 'b', price: null, priceLabel: null })], pricing), { value: 96, partial: true });
    assert.deepEqual(orderTotal([line({ qty: 1 }), line({ id: 'b', currency: 'USD' })], pricing), { value: 48, partial: true });
    assert.equal(orderTotal([line({ price: null })], pricing), null);
  });

  it('limita la cantidad entre 0 y 99', () => {
    assert.equal(clampQty(-3), 0);
    assert.equal(clampQty(2.6), 3);
    assert.equal(clampQty(500), 99);
    assert.equal(clampQty(Number.NaN), 0);
  });

  it('arma el mensaje en español con total, nombre y nota', () => {
    const text = buildOrderMessage({
      lines: [line({ qty: 2, sku: 'PAN-1' }), line({ id: 'b', name: 'Pastel', price: null, priceLabel: null })],
      pricing,
      intro: 'Hola {negocio}, quiero hacer este pedido:',
      businessName: 'Café Aurora',
      customerName: '  Ana ',
      note: 'Sin azúcar',
      siteUrl: 'https://x.test/catalogo/aurora',
      t: siteTranslator('es'),
    });
    assert.equal(
      text,
      [
        'Hola Café Aurora, quiero hacer este pedido:',
        '',
        '• 2 × Croissant (PAN-1) — $96',
        '• 1 × Pastel (precio por confirmar)',
        '',
        'Total: $96 (sin los productos por confirmar)',
        'Nombre: Ana',
        'Nota: Sin azúcar',
        '',
        'Pedido desde https://x.test/catalogo/aurora',
      ].join('\n'),
    );
  });

  it('usa el idioma del sitio y omite lo vacío', () => {
    const text = buildOrderMessage({ lines: [line({ qty: 3 })], pricing, intro: 'Hi {negocio}!', businessName: 'Aurora', siteUrl: 'https://x.test', t: siteTranslator('en') });
    assert.equal(text, ['Hi Aurora!', '', '• 3 × Croissant — $144', '', 'Total: $144', '', 'Order from https://x.test'].join('\n'));
  });

  it('genera el enlace de wa.me sólo con dígitos y el texto codificado', () => {
    assert.equal(orderWhatsappHref('+52 (55) 1234-5678', 'Hola & adiós'), 'https://wa.me/525512345678?text=Hola%20%26%20adi%C3%B3s');
    assert.equal(orderWhatsappHref('', 'x'), null);
  });

  it('entrega, envío y mínimo: lo nuevo viene apagado y el mensaje no cambia', () => {
    const { order } = catalogSettingsSchema.parse({});
    assert.deepEqual({ ...NO_OPTIONS }, { pickup: order.pickup, delivery: order.delivery, deliveryFee: order.deliveryFee, freeDeliveryFrom: order.freeDeliveryFrom, deliveryNote: order.deliveryNote, minimumOrder: order.minimumOrder, payments: order.payments });
    const summary = summarizeOrder([line({ qty: 2 })], pricing);
    assert.deepEqual(summary, { subtotal: { value: 96, partial: false }, delivery: null, total: { value: 96, partial: false }, missingForMinimum: null, missingForFreeDelivery: null, blocker: null, discount: null, couponIssue: null });
    // Montos escritos en el formulario: vacío → sin valor; "1,200.50" y "35,5" se entienden.
    const parsed = catalogSettingsSchema.parse({ order: { deliveryFee: '35,5', freeDeliveryFrom: '1,200.50', minimumOrder: '' } }).order;
    assert.deepEqual([parsed.deliveryFee, parsed.freeDeliveryFrom, parsed.minimumOrder], [35.5, 1200.5, null]);
    assert.equal(catalogSettingsSchema.safeParse({ order: { deliveryFee: 'abc' } }).success, false);
  });

  it('con dos formas de entrega hay que elegir; a domicilio pide la dirección y suma el envío', () => {
    const options: OrderOptions = { ...NO_OPTIONS, pickup: true, delivery: true, deliveryFee: 35, freeDeliveryFrom: 300, payments: ['cash', 'transfer'] };
    const lines = [line({ qty: 2 })]; // 96
    assert.equal(summarizeOrder(lines, pricing, options).blocker, 'fulfillment');
    const home = summarizeOrder(lines, pricing, options, { ...NO_CHOICES, fulfillment: 'delivery' });
    assert.equal(home.blocker, 'address');
    assert.deepEqual(home.delivery, { kind: 'fee', value: 35 });
    assert.deepEqual(home.total, { value: 131, partial: false });
    assert.equal(home.missingForFreeDelivery, 204);
    const free = summarizeOrder([line({ qty: 7 })], pricing, options, { ...NO_CHOICES, fulfillment: 'delivery', address: 'Centro' }); // 336
    assert.deepEqual([free.delivery, free.total?.value, free.blocker], [{ kind: 'free' }, 336, null]);
    const pickup = summarizeOrder(lines, pricing, options, { ...NO_CHOICES, fulfillment: 'pickup' });
    assert.deepEqual([pickup.delivery, pickup.total?.value, pickup.blocker], [null, 96, null]);

    const text = buildOrderMessage({
      lines,
      pricing,
      intro: 'Hola {negocio}:',
      businessName: 'Café',
      siteUrl: 'https://x.test',
      t: siteTranslator('es'),
      options,
      choices: { fulfillment: 'delivery', address: ' Av. Juárez 12 ', payment: 'transfer' },
    });
    assert.equal(
      text,
      ['Hola Café:', '', '• 2 × Croissant — $96', '', 'Subtotal: $96', 'Envío: $35', 'Total: $131', 'Entrega: A domicilio', 'Dirección: Av. Juárez 12', 'Pago: Transferencia', '', 'Pedido desde https://x.test'].join('\n'),
    );
    // En inglés y recogiendo en el local: sin envío ni dirección; un pago que el negocio ya no acepta se omite.
    const english = buildOrderMessage({ lines, pricing, intro: 'Hi {negocio}:', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('en'), options, choices: { fulfillment: 'pickup', address: 'Centro', payment: 'card' } });
    assert.match(english, /Total: \$96\nDelivery: Pickup at the store\n\nOrder from/);
  });

  it('una sola forma de entrega no se elige; envío sin costo fijo se confirma; el mínimo bloquea', () => {
    const options: OrderOptions = { ...NO_OPTIONS, delivery: true, minimumOrder: 150 };
    const summary = summarizeOrder([line({ qty: 2 })], pricing, options, { ...NO_CHOICES, address: 'Centro' });
    assert.deepEqual(summary.delivery, { kind: 'confirm' });
    assert.deepEqual(summary.total, { value: 96, partial: true });
    assert.deepEqual([summary.missingForMinimum, summary.blocker], [54, 'minimum']);
    // Con productos sin precio no se sabe si llega al mínimo: no se bloquea.
    assert.equal(summarizeOrder([line({ qty: 2 }), line({ id: 'b', price: null })], pricing, options, { ...NO_CHOICES, address: 'Centro' }).blocker, null);
    const text = buildOrderMessage({ lines: [line({ qty: 4 })], pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options, choices: { ...NO_CHOICES, address: 'Centro' } });
    assert.match(text, /Subtotal: \$192\nEnvío: por confirmar\nEntrega: A domicilio\nDirección: Centro/);
  });

  it('cupones: el código no viaja al navegador; se encuentra sin importar mayúsculas y descuenta de los productos', () => {
    const settings = catalogSettingsSchema.parse({ order: { coupons: [{ code: ' verano10 ', type: 'percent', value: '10' }, { code: 'MENOS50', type: 'amount', value: 50, minSubtotal: 200 }] } }).order;
    assert.deepEqual(settings.coupons.map((c) => [c.code, c.value, c.active]), [['VERANO10', 10, true], ['MENOS50', 50, true]]);
    assert.equal(catalogSettingsSchema.safeParse({ order: { coupons: [{ code: 'A1B', value: 1 }, { code: 'a1b', value: 2 }] } }).success, false); // repetido
    assert.equal(catalogSettingsSchema.safeParse({ order: { coupons: [{ code: 'MUCHO', value: 150 }] } }).success, false); // > 100 %
    assert.equal(catalogSettingsSchema.safeParse({ order: { coupons: [{ code: 'NO VALE', value: 5 }] } }).success, false);

    const coupons: PublicCoupon[] = settings.coupons.map((c) => ({ hash: couponHash('cafe', c.code), type: c.type, value: c.value, minSubtotal: c.minSubtotal, ends: c.ends }));
    assert.ok(!JSON.stringify(coupons).includes('VERANO10'));
    assert.notEqual(couponHash('cafe', 'VERANO10'), couponHash('otro-negocio', 'VERANO10'));
    assert.equal(findCoupon(coupons, 'cafe', 'nada'), null);
    const percent = findCoupon(coupons, 'cafe', ' Verano10 ')!;
    assert.equal(percent.code, 'VERANO10');

    const options: OrderOptions = { ...NO_OPTIONS, delivery: true, deliveryFee: 35, freeDeliveryFrom: 300 };
    const lines = [line({ qty: 3 })]; // 144
    const summary = summarizeOrder(lines, pricing, options, { ...NO_CHOICES, address: 'Centro', coupon: percent });
    assert.deepEqual(summary.discount, { code: 'VERANO10', value: 14.4 });
    assert.deepEqual(summary.total, { value: 164.6, partial: false }); // 144 − 14.40 + 35
    const text = buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options, choices: { ...NO_CHOICES, address: 'Centro', coupon: percent } });
    assert.match(text, /Subtotal: \$144\nCupón VERANO10: −\$14\.40\nEnvío: \$35\nTotal: \$164\.60\nEntrega: A domicilio/);

    // Monto fijo con mínimo: por debajo no descuenta y dice por qué; nunca deja el total en negativo.
    const fixed = findCoupon(coupons, 'cafe', 'menos50')!;
    assert.deepEqual([summarizeOrder(lines, pricing, NO_OPTIONS, { ...NO_CHOICES, coupon: fixed }).discount, summarizeOrder(lines, pricing, NO_OPTIONS, { ...NO_CHOICES, coupon: fixed }).couponIssue], [null, 'minimum']);
    const big = summarizeOrder([line({ qty: 5 })], pricing, NO_OPTIONS, { ...NO_CHOICES, coupon: { ...fixed, value: 999, minSubtotal: null } });
    assert.deepEqual([big.discount?.value, big.total?.value], [240, 0]);
    // Sin envío, el cupón también desglosa el total.
    assert.match(buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), choices: { ...NO_CHOICES, coupon: percent } }), /Subtotal: \$144\nCupón VERANO10: −\$14\.40\nTotal: \$129\.60/);
    // Vencido (en la zona de quien lo programó): no descuenta.
    const expired = { ...percent, ends: { on: '2026-10-19', timeZone: 'America/Mexico_City' } };
    const late = summarizeOrder(lines, pricing, NO_OPTIONS, { ...NO_CHOICES, coupon: expired }, new Date('2026-10-20T07:00:00Z'));
    assert.deepEqual([late.discount, late.couponIssue, late.total?.value], [null, 'expired', 144]);
  });

  it('visitas: 30 días completos, total, fichas vistas, lo más visto y pedidos por cada 100 visitas', () => {
    const today = new Date('2026-10-19T15:00:00Z');
    const summary = summarizeViews(
      [{ day: '2026-10-19', views: 12 }, { day: '2026-09-20', views: 3 }, { day: '2026-09-19', views: 99 }],
      [{ item_id: 'b', views: 4 }, { item_id: 'a', views: 4 }, { item_id: 'c', views: 1 }, { item_id: 'b', views: 2 }],
      today,
      { top: 2 },
    );
    assert.equal(summary.days.length, 30);
    assert.deepEqual([summary.days[0], summary.days.at(-1)], [{ day: '2026-09-20', count: 3 }, { day: '2026-10-19', count: 12 }]);
    assert.equal(summary.views, 15); // el 19 de septiembre queda fuera
    assert.equal(summary.itemViews, 11);
    assert.deepEqual(summary.top, [{ itemId: 'b', views: 6 }, { itemId: 'a', views: 4 }]);
    assert.equal(ordersPer100Views(3, 120), 2.5);
    assert.equal(ordersPer100Views(1, 3), 33.3);
    assert.equal(ordersPer100Views(5, 0), null);
  });

  it('el pedido guardado se actualiza con los precios de hoy y quita lo que ya no se puede pedir', () => {
    const lines = [line({ id: 'a', price: 40, priceLabel: '$40', qty: 2 }), line({ id: 'b', name: 'Galleta' }), line({ id: 'c:v1', name: 'Latte (16 oz)' })];
    const same = refreshLines([lines[0]], { a: [40, '$40'] });
    assert.equal(same.lines[0], lines[0]); // sin cambios, misma referencia (no re-renderiza)
    const fresh = refreshLines(lines, { a: [45, '$45'], 'c:v1': [78, '$78'] });
    assert.deepEqual(fresh.lines.map((l) => [l.id, l.price, l.qty]), [['a', 45, 2], ['c:v1', 78, 1]]);
    assert.deepEqual(fresh.removed, ['Galleta']);
  });

  it('pausa de pedidos: sin fecha sigue hasta quitarla; con fecha se reanuda al terminar ese día', () => {
    const now = new Date('2026-10-20T05:00:00Z'); // 19 oct, 23:00 en Ciudad de México
    assert.equal(isOrderingPaused(null, now), false);
    assert.equal(isOrderingPaused({ until: '', timeZone: '', message: '' }, now), true);
    assert.equal(isOrderingPaused({ until: '2026-10-19', timeZone: 'America/Mexico_City', message: '' }, now), true);
    assert.equal(isOrderingPaused({ until: '2026-10-19', timeZone: 'America/Mexico_City', message: '' }, new Date('2026-10-20T06:00:00Z')), false);
  });

  it('la configuración del sitio trae el índice de precios, sugerencias sin opciones y la pausa', () => {
    const site = buildSampleSite();
    const config = orderConfig(site)!;
    const latte = site.items.find((i) => i.name === 'Latte de avena')!;
    const espresso = site.items.find((i) => i.name === 'Espresso doble')!;
    assert.deepEqual(config.catalog[espresso.id], [45, '$45']);
    assert.equal(config.catalog[latte.id], undefined); // con opciones: se pide cada opción
    assert.deepEqual(config.catalog[`${latte.id}:v2`], [78, '$78']);
    assert.ok(site.items.filter((i) => i.type === 'service').every((i) => !config.catalog[i.id]));
    assert.ok(config.suggestions.length > 0 && config.suggestions.length <= 6);
    assert.ok(config.suggestions.every((item) => item.price !== null && !item.id.includes(':')));
    assert.equal(config.suggestions[0].id, site.items.find((i) => i.isFeatured && i.type === 'product' && i.isAvailable && !i.variants)!.id);
    assert.equal(config.pause, null);
    const paused = orderConfig({ ...site, settings: { ...site.settings, order: { ...site.settings.order, paused: true, pauseMessage: 'Volvemos pronto' } } })!;
    assert.deepEqual(paused.pause, { until: '', timeZone: '', message: 'Volvemos pronto' });
  });

  it('estadísticas: 30 días completos (con ceros), totales y lo más pedido', () => {
    const today = new Date('2026-10-19T23:30:00Z');
    assert.equal(windowStart(today), '2026-09-20');
    const summary = summarizeOrders(
      [
        { day: '2026-10-19', orders: 2, units: 5, value: '240.50' },
        { day: '2026-10-01', orders: 1, units: 1, value: 48 },
        { day: '2026-09-01', orders: 9, units: 9, value: 900 }, // fuera de la ventana
      ],
      [
        { item_id: 'b', units: 2 },
        { item_id: 'a', units: 3 },
        { item_id: 'b', units: 2 },
        { item_id: 'c', units: 1 },
        { item_id: 'd', units: 1 },
      ],
      today,
    );
    assert.equal(summary.days.length, 30);
    assert.deepEqual(summary.days[0], { day: '2026-09-20', orders: 0 });
    assert.deepEqual(summary.days.at(-1), { day: '2026-10-19', orders: 2 });
    assert.deepEqual([summary.orders, summary.units, summary.value], [3, 6, 288.5]);
    assert.deepEqual(summary.top, [{ itemId: 'b', units: 4 }, { itemId: 'a', units: 3 }, { itemId: 'c', units: 1 }]);
  });
});
