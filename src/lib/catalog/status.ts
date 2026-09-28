import type { CatalogStatus } from '@/types/database';

/**
 * Etiquetas del estado del catálogo. Vive fuera de los componentes cliente
 * para que también puedan usarla los Server Components.
 */
export const STATUS_LABELS: Record<CatalogStatus, { label: string; color: 'default' | 'success' | 'warning' }> = {
  draft: { label: 'Borrador', color: 'default' },
  published: { label: 'Publicado', color: 'success' },
  unpublished: { label: 'No publicado', color: 'warning' },
};
