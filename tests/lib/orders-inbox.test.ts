import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTranslator } from '@/i18n/translate';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { DEFAULT_RANGE, findTab, linesText, NEXT_STATUS, ordersCsv, parseRange } from '@/lib/orders/inbox';
import { inboxOrder, NO_OPTIONS, type OrderLine, type OrderOptions, type OrderPricing } from '@/site-renderer/order/message';
import { orderConfig } from '@/site-renderer/order/config';
import { buildSampleSite } from '@/lib/site/sample-site';

const pricing: OrderPricing = { currency: 'MXN', locale: 'es-MX', format: catalogSettingsSchema.parse({}).priceFormat };
const line = (overrides: Partial<OrderLine>): OrderLine => ({ id: 'a', itemId: '11111111-1111-4111-8111-111111111111', name: 'Croissant', sku: null, price: 48, priceLabel: '$48', currency: 'MXN', url: 'https://x.test/p/croissant', image: null, qty: 1, ...overrides });
const t = createTranslator('es', null);

describe('Bandeja de pedidos', () => {
  it('la bandeja está activa por defecto y el stock no se descuenta solo', () => {
    const { order } = catalogSettingsSchema.parse({});
    assert.equal(order.inbox, true);
    assert.equal(order.inboxStock, false);
  });

  it('la copia del pedido dice lo mismo que el mensaje: entrega, envío, cupón, propina y líneas', () => {
    const options: OrderOptions = { ...NO_OPTIONS, pickup: true, delivery: true, deliveryFee: 35, tips: true, payments: ['cash'] };
    const copy = inboxOrder({
      lines: [line({ qty: 2, note: ' sin azúcar ' }), line({ id: 'b', itemId: null, name: 'Pastel', price: null, priceLabel: null })],
      pricing,
      customerName: '  Ana ',
      note: 'Toco el timbre',
      options,
      choices: { fulfillment: 'delivery', address: ' Calle 5 ', payment: 'cash', tip: 10 },
      reference: 'K7Q2',
    })!;
    assert.equal(copy.reference, 'K7Q2');
    assert.equal(copy.customerName, 'Ana');
    assert.equal(copy.fulfillment, 'delivery');
    assert.equal(copy.address, 'Calle 5');
    assert.equal(copy.payment, 'cash');
    assert.equal(copy.subtotal, 96);
    assert.equal(copy.deliveryFee, 35);
    assert.equal(copy.tip, 9.6);
    assert.equal(copy.partial, true);
    assert.deepEqual(copy.lines.map((l) => [l.itemId, l.name, l.qty, l.unitPrice, l.note]), [
      ['11111111-1111-4111-8111-111111111111', 'Croissant', 2, 48, 'sin azúcar'],
      ['b', 'Pastel', 1, null, ''],
    ]);
  });

  it('para recoger no va la dirección; sin folio o sin productos no hay copia', () => {
    const options: OrderOptions = { ...NO_OPTIONS, pickup: true };
    const copy = inboxOrder({ lines: [line({})], pricing, options, choices: { fulfillment: null, address: 'Calle 5', payment: null }, reference: 'AB12' })!;
    assert.equal(copy.fulfillment, 'pickup');
    assert.equal(copy.address, '');
    assert.equal(inboxOrder({ lines: [line({})], pricing, reference: undefined }), null);
    assert.equal(inboxOrder({ lines: [], pricing, reference: 'AB12' }), null);
  });

  it('sólo el sitio publicado manda la copia, y sólo con la bandeja activa', () => {
    const site = buildSampleSite();
    const on = { ...site, settings: { ...site.settings, order: { ...site.settings.order, enabled: true, inbox: true } } };
    assert.equal(orderConfig(on, { track: true })?.inbox, true);
    assert.equal(orderConfig(on)?.inbox, false, 'la demo y la vista previa no guardan pedidos');
    assert.equal(orderConfig({ ...on, settings: { ...on.settings, order: { ...on.settings.order, inbox: false } } }, { track: true })?.inbox, false);
  });

  it('pestañas, periodos y siguiente estado', () => {
    assert.equal(findTab('en-curso').statuses.join(), 'confirmed,ready');
    assert.equal(findTab('otra').slug, 'nuevos');
    assert.equal(parseRange('7'), 7);
    assert.equal(parseRange('365'), DEFAULT_RANGE);
    assert.equal(NEXT_STATUS.new?.status, 'confirmed');
    assert.equal(NEXT_STATUS.delivered, undefined);
  });

  it('CSV: un pedido por fila, fecha en la zona del negocio y productos en una celda', () => {
    const csv = ordersCsv(t, [
      { reference: 'K7Q2', created_at: '2026-10-20T18:30:00Z', status: 'confirmed', customer_name: 'Ana, "la del 5"', fulfillment: 'delivery', address: 'Calle 5', zone: 'Centro', branch: null, table_label: null, scheduled_for: null, payment: 'cash', coupon: null, note: null, lines: [{ itemId: null, name: 'Croissant', variant: '', qty: 2, unitPrice: 48, note: '' }, { itemId: null, name: 'Café', variant: '', qty: 1, unitPrice: 30, note: '' }], subtotal: 126, discount: null, delivery_fee: 35, tip: null, total: 161, currency: 'MXN' },
    ], 'America/Mexico_City');
    const [header, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
    assert.match(header, /^Folio,Fecha,Estado,Cliente,Entrega/);
    // Excel en español separa con ";": esa celda va entre comillas.
    assert.match(row, /^K7Q2,2026-10-20 12:30,Confirmado,"Ana, ""la del 5""",A domicilio,Calle 5,Centro,,,,Efectivo,,"2 × Croissant; 1 × Café",126\.00,,35\.00,,161\.00,MXN,$/);
    assert.equal(linesText([{ itemId: null, name: 'Pan', variant: '', qty: 3, unitPrice: null, note: '' }]), '3 × Pan');
  });
});
