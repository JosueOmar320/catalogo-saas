import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { BusinessContext } from '@/lib/auth/session';

export const publicCatalogTag = (businessSlug: string) => `public-catalog:${businessSlug}`;

/**
 * Invalida la versión cacheada del catálogo público. `expire: 0` hace que la
 * siguiente visita obtenga datos frescos (el dueño ve su cambio de inmediato).
 */
export function invalidatePublicCatalog(businessSlug: string) {
  revalidateTag(publicCatalogTag(businessSlug), { expire: 0 });
  revalidatePath(`/catalogo/${businessSlug}`, 'layout');
  // El mismo sitio servido en su dominio propio (el proxy lo reescribe a /dominio/<negocio>).
  revalidatePath(`/dominio/${businessSlug}`, 'layout');
}

/**
 * Después de cambiar el catálogo (ítems, categorías, importación…): el sitio
 * público y el panel vuelven a leer. Una sola función para todas las Server
 * Actions, así ninguna olvida una de las dos.
 */
export function afterCatalogChange(ctx: Pick<BusinessContext, 'business'>) {
  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
}
