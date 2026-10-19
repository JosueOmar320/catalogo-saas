import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countReview, isReviewFilter, REVIEW_FILTERS } from '@/features/items/review';
import { displayUrl, readableOn, shareMessages, wrapText } from '@/lib/share/kit';
import { APP_EN } from '@/i18n/en';
import { createTranslator } from '@/i18n/translate';
import { formatRelative } from '@/lib/utils/format';

describe('Inicio del panel', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');

  it('fecha relativa en el idioma del usuario', () => {
    assert.equal(formatRelative('2026-10-19T11:59:40Z', 'es', now), 'ahora');
    assert.equal(formatRelative('2026-10-19T09:00:00Z', 'es', now), 'hace 3 horas');
    assert.equal(formatRelative('2026-10-18T12:00:00Z', 'es', now), 'ayer');
    assert.equal(formatRelative('2026-10-05T12:00:00Z', 'en', now), '2 weeks ago');
  });

  it('filtros de revisión', () => {
    const item = { hasImage: false, hasPrice: true, categoryId: null, isAvailable: true, isVisible: false };
    const matching = Object.entries(REVIEW_FILTERS).filter(([, f]) => f.test(item)).map(([key]) => key);
    assert.deepEqual(matching, ['sin-foto', 'sin-categoria', 'ocultos']);
    assert.ok(isReviewFilter('sin-foto'));
    assert.ok(!isReviewFilter('toString'));
    assert.ok(!isReviewFilter(['sin-foto']));
  });

  it('revisión: oferta vencida y sin descripción sólo cuentan si se manda el dato (el correo semanal no cambia)', () => {
    const base = { type: 'product' as const, hasImage: true, hasPrice: true, categoryId: 'c', isAvailable: true, isVisible: true };
    const counts = countReview([{ ...base, saleOver: true }, { ...base, hasDescription: false }, { ...base, hasDescription: true, saleOver: false }, base], true);
    assert.deepEqual([counts['oferta-vencida'].count, counts['sin-descripcion'].count], [1, 1]);
    assert.deepEqual(Object.entries(REVIEW_FILTERS).filter(([, f]) => f.test(base)).map(([key]) => key), []);
  });
});

describe('Kit para compartir', () => {
  it('mensajes listos con el enlace y el nombre, en el idioma del panel', () => {
    const es = shareMessages(createTranslator('es', null), 'Café Aurora', 'https://x.test/catalogo/cafe');
    assert.deepEqual(es.map((m) => m.id), ['whatsapp', 'status', 'bio']);
    assert.ok(es.every((m) => m.text.includes('https://x.test/catalogo/cafe')));
    assert.match(es[1].text, /Café Aurora/);
    assert.equal(shareMessages(createTranslator('en', APP_EN), 'Café', 'https://x.test')[2].text, 'Order here: https://x.test');
    assert.equal(displayUrl('https://x.test/catalogo/cafe/'), 'x.test/catalogo/cafe');
  });

  it('parte el texto en líneas que caben y recorta con "…"', () => {
    const measure = (value: string) => value.length * 10; // 10 px por letra
    assert.deepEqual(wrapText('Haz tu pedido por WhatsApp', 120, measure), ['Haz tu', 'pedido por', 'WhatsApp']);
    assert.deepEqual(wrapText('uno dos tres cuatro cinco seis', 90, measure, 2), ['uno dos', 'tres…']);
    // Una palabra que no cabe (un enlace largo) se corta con "…" en vez de salirse.
    assert.deepEqual(wrapText('Supercalifragilístico', 50, measure), ['Supe…']);
  });

  it('texto blanco sobre colores oscuros y oscuro sobre claros', () => {
    assert.equal(readableOn('#1A1A1A'), '#ffffff');
    assert.equal(readableOn('#2F54D6'), '#ffffff');
    assert.equal(readableOn('#F5D76E'), '#111111');
  });
});
