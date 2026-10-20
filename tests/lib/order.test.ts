import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { applyTiers, buildOrderMessage, clampQty, couponHash, findCoupon, isOrderingPaused, refreshLines, NO_CHOICES, NO_OPTIONS, orderTotal, orderWhatsappHref, summarizeOrder, tierFor, type OrderLine, type OrderOptions, type OrderPricing, type PublicCoupon } from '@/site-renderer/order/message';
import { siteTranslator } from '@/site-renderer/site-i18n';
import { decodeList, encodeList, mergeLines } from '@/site-renderer/order/share-list';
import { effectivePrice } from '@/lib/catalog/next-price';
import { mapItems, type ItemInput } from '@/lib/catalog/view-model';
import { emptyItemValues } from '@/features/items/defaults';
import { itemFormSchema, itemFormToAttributes } from '@/features/items/schema';
import { dailyReportCsv, productReportCsv } from '@/lib/reports/stats-csv';
import { createTranslator } from '@/i18n/translate';
import { marginOf } from '@/lib/catalog/margin';
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
    assert.deepEqual({ ...NO_OPTIONS }, { pickup: order.pickup, delivery: order.delivery, deliveryFee: order.deliveryFee, freeDeliveryFrom: order.freeDeliveryFrom, deliveryNote: order.deliveryNote, zones: order.zones, tables: order.tables, branches: order.branches, tips: order.tips, minimumOrder: order.minimumOrder, payments: order.payments, scheduling: order.scheduling, leadMinutes: order.leadMinutes, scheduleDays: order.scheduleDays, slotMinutes: order.slotMinutes });
    const summary = summarizeOrder([line({ qty: 2 })], pricing);
    assert.deepEqual(summary, { subtotal: { value: 96, partial: false }, delivery: null, total: { value: 96, partial: false }, minimum: null, zone: null, table: null, branch: null, tip: null, missingForMinimum: null, missingForFreeDelivery: null, blocker: null, discount: null, couponIssue: null });
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

  it('zonas de entrega: se elige la zona; su envío y su mínimo (el mayor con el del negocio) y va en el mensaje', () => {
    const zones = [
      { name: 'Centro', fee: 25, minimumOrder: null },
      { name: 'Norte', fee: null, minimumOrder: 200 },
      { name: 'Vecinos', fee: 0, minimumOrder: null },
    ];
    const options: OrderOptions = { ...NO_OPTIONS, pickup: true, delivery: true, deliveryFee: 99, minimumOrder: 100, zones };
    const lines = [line({ qty: 3 })]; // 144
    const choose = (zone: string | null, address = 'Calle 5') => summarizeOrder(lines, pricing, options, { ...NO_CHOICES, fulfillment: 'delivery', address, zone });
    assert.deepEqual([choose(null).blocker, choose(null).delivery, choose('Sur').blocker], ['zone', null, 'zone']);
    const centro = choose('Centro');
    assert.deepEqual([centro.zone?.name, centro.delivery, centro.total?.value, centro.minimum, centro.blocker], ['Centro', { kind: 'fee', value: 25 }, 169, 100, null]);
    assert.equal(choose('Centro', '').blocker, 'address');
    const norte = choose('Norte');
    assert.deepEqual([norte.delivery, norte.minimum, norte.missingForMinimum, norte.blocker], [{ kind: 'confirm' }, 200, 56, 'minimum']);
    assert.deepEqual(choose('Vecinos').delivery, { kind: 'free' });
    // Recoger en el local: sin zona, sin envío y el mínimo del negocio.
    const pickup = summarizeOrder(lines, pricing, options, { ...NO_CHOICES, fulfillment: 'pickup', zone: 'Norte' });
    assert.deepEqual([pickup.zone, pickup.delivery, pickup.minimum, pickup.blocker], [null, null, 100, null]);

    const text = buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options, choices: { ...NO_CHOICES, fulfillment: 'delivery', address: 'Calle 5', zone: 'Centro' } });
    assert.match(text, /Envío: \$25\nTotal: \$169\nEntrega: A domicilio\nZona: Centro\nDirección: Calle 5/);

    // Formulario: montos escritos, nombres repetidos no.
    const parsed = catalogSettingsSchema.parse({ order: { zones: [{ name: ' Centro ', fee: '25', minimumOrder: '' }] } }).order.zones;
    assert.deepEqual(parsed, [{ name: 'Centro', fee: 25, minimumOrder: null }]);
    assert.equal(catalogSettingsSchema.safeParse({ order: { zones: [{ name: 'Centro' }, { name: 'centro' }] } }).success, false);
    assert.equal(catalogSettingsSchema.safeParse({ order: { zones: [{ name: '' }] } }).success, false);
  });

  it('mayoreo: la línea del producto toma el precio del escalón que alcanza y el mensaje lo dice', () => {
    const tiers = { a: [[6, 42], [12, 38]] as [number, number][] };
    assert.deepEqual([tierFor(tiers.a, 5), tierFor(tiers.a, 6), tierFor(tiers.a, 20)], [null, [6, 42], [12, 38]]);
    const few = [line({ qty: 5 })];
    assert.equal(applyTiers(few, tiers), few); // sin cambios: la misma lista
    const [six] = applyTiers([line({ qty: 6 })], tiers);
    assert.deepEqual([six.price, six.priceLabel, six.wholesale], [42, null, true]);
    // Una opción o un extra del producto no entra al mayoreo.
    assert.equal(applyTiers([line({ id: 'a:v1', itemId: 'a', qty: 12 })], tiers)[0].price, 48);
    assert.equal(summarizeOrder(applyTiers([line({ qty: 12 })], tiers), pricing).total?.value, 456);
    const text = buildOrderMessage({ lines: applyTiers([line({ qty: 12 })], tiers), pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es') });
    assert.match(text, /• 12 × Croissant — \$456 \(mayoreo, \$38 c\/u\)\n\nTotal: \$456/);
  });

  it('pedido en mesa: sin entrega, dirección ni "¿Para cuándo?"; el mensaje dice la mesa y el folio', () => {
    const options: OrderOptions = { ...NO_OPTIONS, pickup: true, delivery: true, deliveryFee: 35, scheduling: 'required', minimumOrder: 150, tables: true };
    const lines = [line({ qty: 2 })];
    const atTable = summarizeOrder(lines, pricing, options, { ...NO_CHOICES, fulfillment: 'delivery', table: '5' });
    // Tampoco pedido mínimo: es para la entrega o para recoger.
    assert.deepEqual([atTable.table, atTable.delivery, atTable.total?.value, atTable.minimum, atTable.blocker], ['5', null, 96, null, null]);
    // Sin pedidos en mesa activos, la mesa no cuenta.
    assert.deepEqual(summarizeOrder(lines, pricing, { ...options, tables: false }, { ...NO_CHOICES, table: '5' }).blocker, 'fulfillment');
    const text = buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options, choices: { ...NO_CHOICES, fulfillment: 'delivery', address: 'Calle 5', table: 'Terraza 2' }, reference: 'K7Q2' });
    assert.equal(text, ['Hola', '', '• 2 × Croissant — $96', '', 'Total: $96', 'Mesa: Terraza 2', 'Folio: K7Q2', '', 'Pedido desde https://x.test'].join('\n'));
  });

  it('sucursales: con varias hay que elegir; el pedido dice la sucursal (con una sola, ésa y sin preguntar)', () => {
    const branches = [
      { name: 'Centro', whatsapp: '+52 55 1111 1111', address: 'Av. Juárez 12' },
      { name: 'Norte', whatsapp: '+52 55 2222 2222', address: '' },
    ];
    const options: OrderOptions = { ...NO_OPTIONS, pickup: true, branches };
    const lines = [line({ qty: 1 })];
    assert.equal(summarizeOrder(lines, pricing, options, { ...NO_CHOICES, fulfillment: 'pickup' }).blocker, 'branch');
    const norte = summarizeOrder(lines, pricing, options, { ...NO_CHOICES, fulfillment: 'pickup', branch: 'Norte' });
    assert.deepEqual([norte.branch?.whatsapp, norte.blocker], ['+52 55 2222 2222', null]);
    const text = buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options, choices: { ...NO_CHOICES, fulfillment: 'pickup', branch: 'Norte' } });
    assert.match(text, /Total: \$48\nSucursal: Norte\nEntrega: Recoger en el local/);
    const single = summarizeOrder(lines, pricing, { ...options, branches: [branches[0]] }, { ...NO_CHOICES, fulfillment: 'pickup' });
    assert.deepEqual([single.branch?.name, single.blocker], ['Centro', null]);
    assert.doesNotMatch(buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options: { ...options, branches: [branches[0]] }, choices: { ...NO_CHOICES, fulfillment: 'pickup' } }), /Sucursal/);
    // Formulario: WhatsApp con formato y sin nombres repetidos.
    assert.equal(catalogSettingsSchema.safeParse({ order: { branches: [{ name: 'Centro', whatsapp: 'abc' }] } }).success, false);
    assert.equal(catalogSettingsSchema.safeParse({ order: { branches: [{ name: 'Centro', whatsapp: '+52 55 1111 1111' }, { name: 'centro', whatsapp: '+52 55 2222 2222' }] } }).success, false);
  });

  it('con sucursales se reciben pedidos aunque el negocio no tenga WhatsApp propio', () => {
    const site = buildSampleSite();
    const noNumber = { ...site, business: { ...site.business, contact: { ...site.business.contact, whatsapp: '' } } };
    assert.equal(orderConfig(noNumber), null);
    const withBranches = { ...noNumber, settings: { ...noNumber.settings, order: { ...noNumber.settings.order, branches: [{ name: 'Centro', whatsapp: '+52 55 1111 1111', address: '' }] } } };
    assert.notEqual(orderConfig(withBranches), null);
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

describe('Compartir mi lista y margen', () => {
  const pricingMXN = { currency: 'MXN' };

  it('la lista viaja en el enlace y vuelve igual (acentos incluidos); lo inválido se descarta', () => {
    const lines = [line({ id: 'p1:v1+x1', qty: 2, name: 'Latte (16 oz) + Canela' }), line({ id: 'p2', qty: 1, name: 'Pan de muerto' })];
    const encoded = encodeList(lines);
    assert.match(encoded, /^[\w-]+$/); // base64url: va tal cual en la URL
    const decoded = decodeList(encoded, pricingMXN, 'https://x.test/c')!;
    assert.deepEqual(decoded.map((l) => [l.id, l.itemId, l.qty, l.name, l.price, l.url]), [
      ['p1:v1+x1', 'p1', 2, 'Latte (16 oz) + Canela', null, 'https://x.test/c'],
      ['p2', 'p2', 1, 'Pan de muerto', null, 'https://x.test/c'],
    ]);
    assert.equal(decodeList('no-es-una-lista', pricingMXN, ''), null);
    assert.equal(decodeList(null, pricingMXN, ''), null);
    const tampered = Buffer.from(JSON.stringify([['<script>', 1, 'x'], ['ok', 0, 'cero'], ['ok', 3, 'Bien']])).toString('base64url');
    assert.deepEqual(decodeList(tampered, pricingMXN, '')!.map((l) => [l.id, l.qty]), [['ok', 3]]);
  });

  it('al agregarla se suman las cantidades de la misma línea', () => {
    const merged = mergeLines([line({ id: 'a', qty: 1 }), line({ id: 'b', qty: 2 })], [line({ id: 'b', qty: 3 }), line({ id: 'c', qty: 1 })]);
    assert.deepEqual(merged.map((l) => [l.id, l.qty]), [['a', 1], ['b', 5], ['c', 1]]);
  });

  it('margen con el costo: monto y porcentaje sobre el precio; sin costo o sin precio, nada', () => {
    assert.deepEqual(marginOf(50, 32), { amount: 18, percent: 36 });
    assert.deepEqual(marginOf(40, 45), { amount: -5, percent: -13 });
    assert.equal(marginOf(null, 10), null);
    assert.equal(marginOf(50, null), null);
    assert.equal(marginOf(0, 10), null);
  });
});

describe('Propina, precio programado y reportes', () => {
  it('propina sobre los productos después del cupón; sólo si el negocio la pide y es una de las opciones', () => {
    const options: OrderOptions = { ...NO_OPTIONS, tips: true, delivery: true, deliveryFee: 30 };
    const lines = [line({ qty: 2 })]; // 96
    const coupon = { hash: 'x', type: 'amount' as const, value: 16, minSubtotal: null, ends: null, code: 'MENOS16' };
    const summary = summarizeOrder(lines, pricing, options, { ...NO_CHOICES, address: 'Centro', coupon, tip: 15 }); // (96 − 16) × 15 % = 12
    assert.deepEqual([summary.tip, summary.total?.value], [{ percent: 15, value: 12 }, 122]);
    assert.equal(summarizeOrder(lines, pricing, { ...options, tips: false }, { ...NO_CHOICES, address: 'Centro', tip: 15 }).tip, null);
    assert.equal(summarizeOrder(lines, pricing, options, { ...NO_CHOICES, address: 'Centro', tip: 37 }).tip, null);
    const text = buildOrderMessage({ lines, pricing, intro: 'Hola', businessName: 'Café', siteUrl: 'https://x.test', t: siteTranslator('es'), options: { ...options, delivery: false }, choices: { ...NO_CHOICES, tip: 10 } });
    assert.match(text, /Subtotal: \$96\nPropina \(10 %\): \$9\.60\nTotal: \$105\.60/);
  });

  it('precio programado: vale desde ese día en la zona de quien lo programó', () => {
    const next = { on: '2026-11-01', price: 55, timeZone: 'America/Mexico_City' };
    assert.equal(effectivePrice(50, next, new Date('2026-11-01T05:59:00Z')), 50); // 31 oct, 23:59
    assert.equal(effectivePrice(50, next, new Date('2026-11-01T06:00:00Z')), 55);
    assert.equal(effectivePrice(50, null, new Date('2030-01-01T00:00:00Z')), 50);
    const row = { id: '11111111-1111-4111-8111-111111111111', slug: 'pan', type: 'product', name: 'Pan', short_description: null, description: null, price: 50, compare_at_price: null, currency: 'MXN', price_note: null, sku: null, is_available: true, is_featured: false, is_visible: true, tags: [], category_id: null, position: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', attributes: { nextPrice: next }, images: [] } as unknown as ItemInput;
    assert.deepEqual(mapItems([row], [], 'cafe', { locale: 'es-MX', now: new Date('2026-10-20T12:00:00Z') }).map((i) => i.price), [50]);
    assert.deepEqual(mapItems([row], [], 'cafe', { locale: 'es-MX', now: new Date('2026-11-02T12:00:00Z') }).map((i) => i.price), [55]);
    const values = itemFormSchema.parse({ ...emptyItemValues('product', 'MXN'), name: 'Pan', price: '50', nextPrice: '55', nextPriceOn: '2026-11-01', saleTimeZone: 'America/Mexico_City' });
    assert.deepEqual(itemFormToAttributes(values).nextPrice, next);
    assert.equal(itemFormSchema.safeParse({ ...emptyItemValues('product', 'MXN'), name: 'Pan', price: '50', nextPrice: '55' }).success, false);
  });

  it('reportes CSV: un día por fila (también en cero) con totales; productos de más a menos pedidos', () => {
    const counts = new Map([
      ['2026-10-18', { views: 10, itemViews: 4, orders: 2, units: 3, value: 150.5 }],
      ['2026-10-19', { views: 5 }],
    ]);
    const daily = dailyReportCsv(createTranslator('es', null), counts, new Date('2026-10-19T12:00:00Z'), 3).replace(/^\uFEFF/, '').trim().split('\r\n');
    assert.deepEqual(daily, ['Fecha,Visitas,Fichas vistas,Pedidos,Unidades,Valor estimado', '2026-10-17,0,0,0,0,0.00', '2026-10-18,10,4,2,3,150.50', '2026-10-19,5,0,0,0,0.00', 'Total,15,4,2,3,150.50']);
    const products = productReportCsv(createTranslator('es', null), [{ id: 'a', name: 'Flan', sku: null, type: 'product' }, { id: 'b', name: 'Pan, dulce', sku: 'P-1', type: 'product' }], new Map([['a', 9]]), new Map([['b', 4]])).replace(/^\uFEFF/, '').trim().split('\r\n');
    assert.deepEqual(products, ['Nombre,Código,Tipo,Visitas a la ficha,Unidades pedidas', '"Pan, dulce",P-1,Producto,0,4', 'Flan,,Producto,9,0']);
  });
});

