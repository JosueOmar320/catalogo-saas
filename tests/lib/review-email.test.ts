import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { countReview } from '@/features/items/review';
import { buildCatalogReviewEmail } from '@/lib/email/catalog-review';
import { unsubscribeToken, verifyUnsubscribeToken } from '@/lib/email/links';

const base = {
  locale: 'es' as const,
  recipientName: 'Ana',
  businessName: 'Café <Aurora> & "Pan"',
  counts: { noPhoto: 2, noPrice: 1, noCategory: 0 },
  appName: 'Vitrina',
  dashboardUrl: 'https://x.test/dashboard',
  unsubscribeUrl: 'https://x.test/baja?token=abc',
};

describe('Aviso semanal por correo', () => {
  it('asunto y líneas en español, sólo con los pendientes que existen', () => {
    const email = buildCatalogReviewEmail(base);
    assert.equal(email.subject, 'Café <Aurora> & "Pan": 3 detalles para mejorar tu catálogo');
    assert.match(email.text, /^Hola, Ana:/);
    assert.match(email.text, /• 2 productos o servicios sin foto\n• 1 producto sin precio\n\n/);
    assert.doesNotMatch(email.text, /sin categoría/);
    assert.match(email.text, /Revisar mi catálogo: https:\/\/x\.test\/dashboard/);
    assert.match(email.text, /Dejar de recibir estos avisos: https:\/\/x\.test\/baja\?token=abc$/);
  });

  it('escapa el nombre del negocio en el HTML', () => {
    const { html } = buildCatalogReviewEmail(base);
    assert.ok(html.includes('Café &lt;Aurora&gt; &amp; &quot;Pan&quot;'));
    assert.ok(!html.includes('<Aurora>'));
  });

  it('singular y en inglés', () => {
    const email = buildCatalogReviewEmail({ ...base, locale: 'en', recipientName: null, businessName: 'Aurora', counts: { noPhoto: 0, noPrice: 0, noCategory: 1 } });
    assert.equal(email.subject, 'Aurora: 1 thing to improve in your catalog');
    assert.match(email.text, /^Hi,\n/);
    assert.match(email.text, /• 1 uncategorized product or service/);
    assert.match(email.html, /<html lang="en">/);
  });

  it('las reseñas por aprobar cuentan y van en su línea (también solas)', () => {
    const email = buildCatalogReviewEmail({ ...base, counts: { noPhoto: 0, noPrice: 1, noCategory: 0, pendingReviews: 2 } });
    assert.equal(email.subject, 'Café <Aurora> & "Pan": 3 detalles para mejorar tu catálogo');
    assert.match(email.text, /• 1 producto sin precio\n• 2 reseñas de clientes por aprobar\n/);
    const only = buildCatalogReviewEmail({ ...base, locale: 'en', counts: { noPhoto: 0, noPrice: 0, noCategory: 0, pendingReviews: 1 } });
    assert.match(only.text, /• 1 customer review to approve/);
  });

  it('el enlace de baja es válido sólo para ese usuario y ese secreto', () => {
    // Claves generadas al vuelo: ningún valor fijo que un escáner de secretos confunda con uno real.
    const key = randomBytes(24).toString('hex');
    const otherKey = randomBytes(24).toString('hex');
    const user = 'aaaaaaaa-0000-4000-8000-000000000001';
    const token = unsubscribeToken(user, key);
    assert.equal(verifyUnsubscribeToken(token, key), user);
    assert.equal(verifyUnsubscribeToken(token, otherKey), null);
    assert.equal(verifyUnsubscribeToken(token.replace(user, 'bbbbbbbb-0000-4000-8000-000000000002'), key), null);
    assert.equal(verifyUnsubscribeToken(`${token}x`, key), null);
    assert.equal(verifyUnsubscribeToken(token, ''), null);
    assert.equal(verifyUnsubscribeToken('', key), null);
  });

  it('cuenta pendientes con el mismo criterio que el inicio del panel', () => {
    const item = (overrides: object) => ({ type: 'product' as const, hasImage: true, hasPrice: true, categoryId: 'c', isAvailable: true, isVisible: true, ...overrides });
    const items = [item({ hasImage: false }), item({ hasPrice: false }), item({ type: 'service', hasPrice: false, categoryId: null }), item({ isVisible: false })];
    const withCategories = countReview(items, true);
    assert.deepEqual(
      [withCategories['sin-foto'].count, withCategories['sin-precio'].count, withCategories['sin-categoria'].count, withCategories.ocultos.count],
      [1, 1, 1, 1],
    );
    assert.equal(countReview(items, false)['sin-categoria'].count, 0);
  });
});
