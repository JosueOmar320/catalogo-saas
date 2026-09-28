import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';

export const publicCatalogTag = (businessSlug: string) => `public-catalog:${businessSlug}`;

/**
 * Invalida la versión cacheada del catálogo público. `expire: 0` hace que la
 * siguiente visita obtenga datos frescos (el dueño ve su cambio de inmediato).
 */
export function invalidatePublicCatalog(businessSlug: string) {
  revalidateTag(publicCatalogTag(businessSlug), { expire: 0 });
  revalidatePath(`/catalogo/${businessSlug}`, 'layout');
}
