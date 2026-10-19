import type { CatalogStatus } from '@/types/database';
import { msg } from '@/i18n/translate';

/**
 * Etiquetas del estado del catálogo. Vive fuera de los componentes cliente
 * para que también puedan usarla los Server Components.
 */
export const STATUS_LABELS: Record<CatalogStatus, { label: string; color: 'default' | 'success' | 'warning' }> = {
  draft: { label: msg('Borrador'), color: 'default' },
  published: { label: msg('Publicado'), color: 'success' },
  unpublished: { label: msg('No publicado'), color: 'warning' },
};
