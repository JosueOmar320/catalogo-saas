import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_EN } from '@/i18n/en';
import { createTranslator } from '@/i18n/translate';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { customersCsv, customerWhatsappLink, findSort, orderUpdateMessage, whatsappNumber, type Customer } from '@/lib/orders/customers';
import { ordersCsv } from '@/lib/orders/inbox';
import { buildSampleSite } from '@/lib/site/sample-site';
import { orderConfig } from '@/site-renderer/order/config';
import { buildOrderMessage, inboxOrder, type OrderLine, type OrderPricing } from '@/site-renderer/order/message';

const es = createTranslator('es', null);
const en = createTranslator('en', APP_EN);
const pricing: OrderPricing = { currency: 'MXN', locale: 'es-MX', format: catalogSettingsSchema.parse({}).priceFormat };
const line: OrderLine = { id: 'a', itemId: null, name: 'Croissant', sku: null, price: 48, priceLabel: '$48', currency: 'MXN', url: 'https://x.test/p/croissant', image: null, qty: 1 };

describe('Clientes', () => {
  it('el WhatsApp del cliente para wa.me: con lada, o con la del negocio si la omitió', () => {
    assert.equal(whatsappNumber('+52 1 55 1234 5678'), '5215512345678');
    assert.equal(whatsappNumber('55 1234 5678', '+52 1 55 9999 0000'), '5215512345678');
    assert.equal(whatsappNumber('5512345678', '+1 (415) 555-0100'), '15512345678');
    assert.equal(whatsappNumber('5512345678', ''), '5512345678');
    assert.equal(whatsappNumber('12 34'), null);
    assert.equal(whatsappNumber(null), null);
    assert.equal(customerWhatsappLink('5512345678', '5215599990000', '¡Hola, Ana!'), 'https://wa.me/5215512345678?text=%C2%A1Hola%2C%20Ana!');
    assert.equal(customerWhatsappLink(null, '5215599990000', 'x'), null);
  });

  it('el aviso al cliente cambia con el estado del pedido y usa su primer nombre', () => {
    const data = { name: 'Ana López', reference: 'K7Q2', business: 'Café Aurora' };
    assert.equal(orderUpdateMessage(es, 'ready', data), '¡Hola, Ana! Tu pedido #K7Q2 de Café Aurora está listo.');
    assert.match(orderUpdateMessage(es, 'confirmed', { ...data, name: null }), /^¡Hola! Confirmamos tu pedido #K7Q2/);
    assert.equal(orderUpdateMessage(en, 'ready', data), 'Hi, Ana! Your order #K7Q2 from Café Aurora is ready.');
  });

  it('el pedido pide el WhatsApp sólo con la bandeja; va en la copia, no en el mensaje', () => {
    assert.equal(catalogSettingsSchema.parse({}).order.askPhone, true);
    const site = buildSampleSite();
    const order = (inbox: boolean) => ({ ...site, settings: { ...site.settings, order: { ...site.settings.order, enabled: true, inbox, askPhone: true } } });
    assert.equal(orderConfig(order(true))?.askPhone, true);
    assert.equal(orderConfig(order(false))?.askPhone, false);

    const copy = inboxOrder({ lines: [line], pricing, customerName: 'Ana', customerPhone: ' 55 1234 5678 ', reference: 'K7Q2' })!;
    assert.equal(copy.customerPhone, '55 1234 5678');
    assert.equal(inboxOrder({ lines: [line], pricing, reference: 'K7Q2' })!.customerPhone, '');
    const message = buildOrderMessage({ lines: [line], pricing, intro: 'Hola', businessName: 'Café', customerName: 'Ana', siteUrl: 'https://x.test', t: es, reference: 'K7Q2' });
    assert.ok(!message.includes('5512345678'));
  });

  it('orden de la lista y CSV de clientes (y el WhatsApp en el CSV de pedidos)', () => {
    assert.equal(findSort('gasto').column, 'spent');
    assert.equal(findSort('otro').slug, 'recientes');
    const customer: Customer = { key: 'tel:5512345678', name: 'Ana', phone: '5512345678', orders: 3, delivered: 2, spent: 145.5, currency: 'MXN', firstOrderAt: '2026-10-01T18:00:00Z', lastOrderAt: '2026-10-20T18:00:00Z' };
    assert.equal(customersCsv(es, [customer], 'America/Mexico_City'), '\uFEFFCliente,WhatsApp,Pedidos,Entregados,Total,Moneda,Primer pedido,Último pedido\r\nAna,5512345678,3,2,145.50,MXN,2026-10-01,2026-10-20\r\n');
    const csv = ordersCsv(es, [{ reference: 'K7Q2', created_at: '2026-10-20T18:00:00Z', status: 'new', customer_name: 'Ana', customer_phone: '5512345678', fulfillment: null, address: null, zone: null, branch: null, table_label: null, scheduled_for: null, payment: null, coupon: null, note: null, lines: [], subtotal: null, discount: null, delivery_fee: null, tip: null, total: null, currency: 'MXN' }]);
    assert.match(csv.split('\r\n')[0], /^\uFEFF?Folio,Fecha,Estado,Cliente,WhatsApp,Entrega/);
    assert.match(csv.split('\r\n')[1], /,Ana,5512345678,/);
  });
});
