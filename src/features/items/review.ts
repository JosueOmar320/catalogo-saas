import { msg } from '@/i18n/translate';

/**
 * Filtros de revisión del listado de ítems ("sin foto", "ocultos"…). El
 * inicio del panel cuenta lo mismo y enlaza a cada filtro por la URL
 * (?revisar=sin-foto), así ambos usan un único criterio.
 */
export const REVIEW_FILTERS = {
  'sin-foto': { label: msg('Sin foto'), test: (i: ReviewableItem) => !i.hasImage },
  'sin-precio': { label: msg('Sin precio'), test: (i: ReviewableItem) => !i.hasPrice },
  'sin-categoria': { label: msg('Sin categoría'), test: (i: ReviewableItem) => !i.categoryId },
  agotados: { label: msg('Agotados'), test: (i: ReviewableItem) => !i.isAvailable },
  ocultos: { label: msg('Ocultos'), test: (i: ReviewableItem) => !i.isVisible },
  // Sólo cuentan si quien llama manda el dato (el aviso por correo no los usa).
  'oferta-vencida': { label: msg('Oferta vencida'), test: (i: ReviewableItem) => i.saleOver === true },
  'sin-descripcion': { label: msg('Sin descripción'), test: (i: ReviewableItem) => i.hasDescription === false },
} as const;

export type ReviewFilter = keyof typeof REVIEW_FILTERS;
export type ReviewableItem = {
  hasImage: boolean;
  hasPrice: boolean;
  categoryId: string | null;
  isAvailable: boolean;
  isVisible: boolean;
  /** Tiene descripción corta o larga (opcional: si no se manda, no cuenta). */
  hasDescription?: boolean;
  /** Tiene precio anterior con una fecha de fin que ya pasó. */
  saleOver?: boolean;
};

export const isReviewFilter = (value: unknown): value is ReviewFilter => typeof value === 'string' && Object.hasOwn(REVIEW_FILTERS, value);

export type ReviewInput = ReviewableItem & { type: 'product' | 'service' };

/** Orden en que se muestran; los tres primeros son pendientes "accionables" (el aviso por correo sólo resume ésos). */
export const REVIEW_ORDER: ReviewFilter[] = ['sin-foto', 'sin-precio', 'sin-categoria', 'oferta-vencida', 'sin-descripcion', 'agotados', 'ocultos'];
export const ACTIONABLE_REVIEW: ReviewFilter[] = ['sin-foto', 'sin-precio', 'sin-categoria'];

/**
 * Cuántos ítems caen en cada filtro (y cuántos de ellos son productos, para
 * enlazar a la lista donde hay más). "Sin precio" sólo cuenta productos: un
 * servicio "a cotizar" es válido. "Sin categoría" sólo si el catálogo tiene categorías.
 */
export function countReview(items: ReviewInput[], hasCategories: boolean): Record<ReviewFilter, { count: number; products: number }> {
  const result = Object.fromEntries(REVIEW_ORDER.map((filter) => [filter, { count: 0, products: 0 }])) as Record<ReviewFilter, { count: number; products: number }>;
  for (const item of items) {
    for (const filter of REVIEW_ORDER) {
      if (filter === 'sin-precio' && item.type !== 'product') continue;
      if (filter === 'sin-categoria' && !hasCategories) continue;
      if (!REVIEW_FILTERS[filter].test(item)) continue;
      result[filter].count++;
      if (item.type === 'product') result[filter].products++;
    }
  }
  return result;
}
