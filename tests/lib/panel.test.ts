import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isReviewFilter, REVIEW_FILTERS } from '@/features/items/review';
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
});
