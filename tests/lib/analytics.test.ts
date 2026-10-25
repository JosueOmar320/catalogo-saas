import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectSource, trackedLink } from '@/lib/analytics/source';
import { change, parseAnalyticsRange, productAnalytics, summarizeAnalytics } from '@/lib/analytics/summary';

const host = 'tienda.test';
const today = new Date('2026-10-30T15:00:00Z');

describe('Analítica: de dónde llega cada visita', () => {
  it('el enlace manda (?ref, utm_source, ?mesa, ?opinar); si no, la página anterior', () => {
    assert.equal(detectSource({ search: '?ref=ig', referrer: 'https://www.google.com/', host }), 'instagram');
    assert.equal(detectSource({ search: '?utm_source=Facebook&utm_medium=cpc', referrer: '', host }), 'facebook');
    assert.equal(detectSource({ search: '?ref=volante', referrer: '', host }), 'qr');
    assert.equal(detectSource({ search: '?ref=algo-raro', referrer: '', host }), 'other');
    assert.equal(detectSource({ search: '?mesa=5', referrer: '', host }), 'qr');
    assert.equal(detectSource({ search: '?opinar', referrer: '', host }), 'reviews');
    assert.equal(detectSource({ search: '', referrer: 'https://l.instagram.com/?u=x', host }), 'instagram');
    assert.equal(detectSource({ search: '', referrer: 'https://lm.facebook.com/l.php', host }), 'facebook');
    assert.equal(detectSource({ search: '', referrer: 'https://www.google.com.mx/', host }), 'google');
    assert.equal(detectSource({ search: '', referrer: 'https://duckduckgo.com/', host }), 'search');
    assert.equal(detectSource({ search: '', referrer: 'https://t.co/abc', host }), 'x');
    assert.equal(detectSource({ search: '', referrer: 'https://blog.ejemplo.com/post', host }), 'referral');
    assert.equal(detectSource({ search: '', referrer: `https://${host}/catalogo/x`, host }), 'direct');
    assert.equal(detectSource({ search: '', referrer: '', host }), 'direct');
    assert.equal(detectSource({ search: '', referrer: 'no es url', host }), 'direct');
  });

  it('enlaces con seguimiento', () => {
    assert.equal(trackedLink('https://x.test/catalogo/cafe', 'instagram'), 'https://x.test/catalogo/cafe?ref=instagram');
    assert.equal(trackedLink('https://x.test/catalogo/cafe?opinar', 'qr'), 'https://x.test/catalogo/cafe?opinar&ref=qr');
  });
});

describe('Analítica: el periodo contra el anterior', () => {
  const funnel = [
    { day: '2026-10-30', source: 'instagram', sessions: 40, viewed_product: 20, started_cart: 8, sent_order: 4 },
    { day: '2026-10-25', source: 'qr', sessions: 10, viewed_product: 6, started_cart: 3, sent_order: 2 },
    // Periodo anterior (7 días antes) y fuera de los dos periodos.
    { day: '2026-10-20', source: 'direct', sessions: 25, viewed_product: 5, started_cart: 2, sent_order: 2 },
    { day: '2026-09-01', source: 'direct', sessions: 999, viewed_product: 0, started_cart: 0, sent_order: 0 },
  ];
  const orders = [
    { day: '2026-10-29', orders: 5, units: 9, value: '450.50' },
    { day: '2026-10-21', orders: 2, units: 2, value: 100 },
  ];
  const pageViews = [{ day: '2026-10-28', views: 120 }];

  it('totales, conversión, ticket y variación; el recorrido con porcentajes; orígenes ordenados', () => {
    const s = summarizeAnalytics({ funnel, orders, pageViews }, today, 7);
    assert.equal(s.from, '2026-10-24');
    assert.equal(s.to, '2026-10-30');
    assert.deepEqual(s.current, { sessions: 50, pageViews: 120, viewedProduct: 26, startedCart: 11, sentOrder: 6, orders: 5, units: 9, value: 450.5 });
    assert.equal(s.previous.sessions, 25);
    assert.deepEqual(s.conversion, { current: 12, previous: 8 });
    assert.deepEqual(s.ticket, { current: 90.1, previous: 50 });
    assert.equal(change(s.current.sessions, s.previous.sessions), 100);
    assert.equal(change(5, 0), null);
    assert.deepEqual(s.funnel.map((step) => [step.key, step.value, step.ofVisits, step.ofPrevious]), [
      ['sessions', 50, 100, null],
      ['viewedProduct', 26, 52, 52],
      ['startedCart', 11, 22, 42.3],
      ['sentOrder', 6, 12, 54.5],
    ]);
    assert.deepEqual(s.sources, [
      { source: 'instagram', sessions: 40, orders: 4, conversion: 10 },
      { source: 'qr', sessions: 10, orders: 2, conversion: 20 },
    ]);
    assert.equal(s.days.length, 7);
    assert.deepEqual(s.days.at(-1), { day: '2026-10-30', sessions: 40, orders: 0 });
    assert.deepEqual(s.days.find((d) => d.day === '2026-10-29'), { day: '2026-10-29', sessions: 0, orders: 5 });
    assert.equal(s.funnelSince, '2026-10-20');
  });

  it('periodo por la URL (7, 30 o 90; si no, 30)', () => {
    assert.equal(parseAnalyticsRange('90'), 90);
    assert.equal(parseAnalyticsRange('365'), 30);
    assert.equal(parseAnalyticsRange(undefined), 30);
  });

  it('productos: los más pedidos y los que se agregan pero casi no se piden', () => {
    const items = [{ id: 'a', name: 'Latte' }, { id: 'b', name: 'Pastel' }, { id: 'c', name: 'Sin datos' }];
    const { top, leaks } = productAnalytics(items, new Map([['a', 50], ['b', 30]]), new Map([['a', 4], ['b', 9]]), new Map([['a', 4], ['b', 2]]));
    assert.deepEqual(top.map((row) => row.name), ['Latte', 'Pastel']);
    assert.deepEqual(leaks.map((row) => [row.name, row.adds, row.units]), [['Pastel', 9, 2]]);
  });
});
