/**
 * Reseñas aprobadas del sitio público y su resumen (promedio y cantidad).
 * Puro: lo usan la ficha, las tarjetas, la sección de testimonios y los datos
 * estructurados.
 */
export type PublicReview = { id: string; itemId: string | null; name: string; rating: number; body: string; createdAt: string };

export type RatingSummary = { average: number; count: number };

/** Promedio (una cifra decimal) de las reseñas de un producto, o de todas (`itemId` undefined). */
export function ratingOf(reviews: PublicReview[], itemId?: string): RatingSummary | null {
  const list = itemId === undefined ? reviews : reviews.filter((r) => r.itemId === itemId);
  if (!list.length) return null;
  const average = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
  return { average: Math.round(average * 10) / 10, count: list.length };
}

/** Lo que llega de get_public_reviews → vista. */
export const toPublicReview = (row: { id: string; item_id: string | null; name: string; rating: number; body: string; created_at: string }): PublicReview => ({
  id: row.id,
  itemId: row.item_id,
  name: row.name,
  rating: row.rating,
  body: row.body,
  createdAt: row.created_at,
});
