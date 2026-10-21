import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import type { ReviewStatus } from '@/types/database';

export type PanelReview = {
  id: string;
  name: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: string;
  /** Producto reseñado (null = del negocio en general). */
  item: { id: string; name: string } | null;
};

/** Tope de filas por consulta (la bandeja avisa cuando llega a él). */
export const PAGE = 200;

/**
 * Reseñas del negocio activo en un estado (RLS: sólo sus miembros), las más
 * recientes primero, con el nombre del producto. null si no se pueden leer
 * (p. ej. la migración aún no está aplicada).
 */
export async function listReviews(ctx: BusinessContext, status: ReviewStatus): Promise<PanelReview[] | null> {
  const { data, error } = await ctx.supabase
    .from('reviews')
    .select('id, item_id, name, rating, body, status, created_at')
    .eq('business_id', ctx.business.id)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (error) {
    console.error('[reviews] no se pudieron leer las reseñas', { code: error.code });
    return null;
  }
  const itemIds = [...new Set(data.flatMap((r) => (r.item_id ? [r.item_id] : [])))];
  const names = new Map<string, string>();
  if (itemIds.length) {
    const items = await ctx.supabase.from('catalog_items').select('id, name').eq('business_id', ctx.business.id).in('id', itemIds);
    for (const item of items.data ?? []) names.set(item.id, item.name);
  }
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    rating: r.rating,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
    item: r.item_id ? { id: r.item_id, name: names.get(r.item_id) ?? '' } : null,
  }));
}

/** Cuántas esperan aprobación (null si no se puede leer). */
export async function countPendingReviews(ctx: BusinessContext): Promise<number | null> {
  const { count, error } = await ctx.supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('business_id', ctx.business.id).eq('status', 'pending');
  return error ? null : (count ?? 0);
}
