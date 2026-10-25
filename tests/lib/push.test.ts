import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import webpush from 'web-push';
import { APP_EN } from '@/i18n/en';
import { createTranslator } from '@/i18n/translate';
import { deviceLabel, isPushEndpoint, orderPushPayload, vapidKeyBytes } from '@/lib/push/core';

const es = createTranslator('es', null);
const en = createTranslator('en', APP_EN);
const order = { reference: 'K7Q2', customerName: 'Ana', items: 3, total: 96, currency: 'MXN', partial: false, businessName: 'Café Aurora' };

describe('Avisos push de pedidos', () => {
  it('sólo se avisa a los servicios de push de los navegadores (https, sin puerto)', () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/QK', 'https://wns2-bl2p.notify.windows.com/w/?token=x']) assert.ok(isPushEndpoint(ok), ok);
    for (const bad of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://evil.test/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.test/x', 'https://169.254.169.254/latest', 'no es url', 42, `https://fcm.googleapis.com/${'x'.repeat(1000)}`]) assert.ok(!isPushEndpoint(bad), String(bad).slice(0, 60));
  });

  it('el aviso dice folio, negocio, cliente, productos y total en el idioma de quien lo recibe', () => {
    assert.deepEqual(orderPushPayload(es, order), { title: 'Pedido nuevo #K7Q2 · Café Aurora', body: 'Ana · 3 productos · $96', url: '/dashboard/pedidos', tag: 'order-K7Q2' });
    const english = orderPushPayload(en, { ...order, customerName: null, items: 1, total: null }, 'en-US');
    assert.equal(english.title, 'New order #K7Q2 · Café Aurora');
    assert.equal(english.body, '1 product');
    assert.match(orderPushPayload(es, { ...order, partial: true }).body, /\$96 \+$/);
  });

  it('la clave pública VAPID se convierte a los 65 bytes que pide el navegador', () => {
    const { publicKey } = webpush.generateVAPIDKeys();
    const bytes = vapidKeyBytes(publicKey);
    assert.equal(bytes.length, 65);
    assert.equal(bytes[0], 4);
    assert.equal(Buffer.from(bytes).toString('base64url'), publicKey);
  });

  it('nombre del dispositivo', () => {
    assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'), 'Chrome · Mac');
    assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1'), 'Safari · iPhone');
    assert.equal(deviceLabel(''), 'Navegador');
  });
});
