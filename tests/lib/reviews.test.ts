import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ratingOf, reviewInviteUrl, toPublicReview, type PublicReview } from '@/lib/catalog/reviews';

const review = (id: string, itemId: string | null, rating: number): PublicReview => ({ id, itemId, name: 'Ana', rating, body: '', createdAt: '2026-10-01T00:00:00Z' });

describe('Reseñas', () => {
  const reviews = [review('1', 'a', 5), review('2', 'a', 4), review('3', 'a', 4), review('4', null, 1), review('5', 'b', 3)];

  it('promedio con una cifra decimal y cantidad, por producto', () => {
    assert.deepEqual(ratingOf(reviews, 'a'), { average: 4.3, count: 3 });
    assert.deepEqual(ratingOf(reviews, 'b'), { average: 3, count: 1 });
  });

  it('sin itemId: todas (las del negocio y las de productos)', () => {
    assert.deepEqual(ratingOf(reviews), { average: 3.4, count: 5 });
  });

  it('sin reseñas: null', () => {
    assert.equal(ratingOf(reviews, 'c'), null);
    assert.equal(ratingOf([]), null);
  });

  it('de la fila pública a la vista', () => {
    assert.deepEqual(toPublicReview({ id: 'x', item_id: null, name: 'Ana', rating: 5, body: 'Rico', created_at: '2026-10-01T00:00:00Z' }), {
      id: 'x',
      itemId: null,
      name: 'Ana',
      rating: 5,
      body: 'Rico',
      createdAt: '2026-10-01T00:00:00Z',
      reply: null,
    });
  });

  it('la respuesta del negocio: recortada, y vacía o ausente (antes de la migración) = null', () => {
    const row = { id: 'x', item_id: null, name: 'Ana', rating: 5, body: 'Rico', created_at: '2026-10-01T00:00:00Z' };
    assert.equal(toPublicReview({ ...row, reply: '  ¡Gracias, Ana!  ' }).reply, '¡Gracias, Ana!');
    assert.equal(toPublicReview({ ...row, reply: '   ' }).reply, null);
    assert.equal(toPublicReview({ ...row, reply: null }).reply, null);
  });

  it('enlace para pedir reseñas', () => {
    assert.equal(reviewInviteUrl('https://x.test/catalogo/cafe'), 'https://x.test/catalogo/cafe?opinar');
  });
});
