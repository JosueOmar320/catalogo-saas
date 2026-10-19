import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { buildOrderMessage, clampQty, NO_CHOICES, NO_OPTIONS, orderTotal, orderWhatsappHref, summarizeOrder, type OrderLine, type OrderOptions, type OrderPricing } from '@/site-renderer/order/message';
import { siteTranslator } from '@/site-renderer/site-i18n';
import { summarizeOrders, windowStart } from '@/lib/orders/stats';

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
    assert.deepEqual(summary, { subtotal: { value: 96, partial: false }, delivery: null, total: { value: 96, partial: false }, missingForMinimum: null, missingForFreeDelivery: null, blocker: null });
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
