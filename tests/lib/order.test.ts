import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { buildOrderMessage, clampQty, orderTotal, orderWhatsappHref, type OrderLine, type OrderPricing } from '@/site-renderer/order/message';
import { siteTranslator } from '@/site-renderer/site-i18n';

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
});
