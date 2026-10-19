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
} as const;

export type ReviewFilter = keyof typeof REVIEW_FILTERS;
export type ReviewableItem = { hasImage: boolean; hasPrice: boolean; categoryId: string | null; isAvailable: boolean; isVisible: boolean };

export const isReviewFilter = (value: unknown): value is ReviewFilter => typeof value === 'string' && Object.hasOwn(REVIEW_FILTERS, value);
