import { msg } from '@/i18n/translate';
import type { ReviewStatus } from '@/types/database';

/** Pestañas de /dashboard/resenas (?estado=…): la página y la lista las comparten. */
export const REVIEW_TABS = [
  { status: 'pending', slug: 'pendientes', label: msg('Pendientes') },
  { status: 'approved', slug: 'aprobadas', label: msg('Publicadas') },
  { status: 'rejected', slug: 'rechazadas', label: msg('Rechazadas') },
] as const satisfies readonly { status: ReviewStatus; slug: string; label: string }[];
