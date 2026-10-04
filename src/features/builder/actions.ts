'use server';

import { revalidatePath } from 'next/cache';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { pageToRow } from '@/lib/site/pages';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { collectMediaPaths } from '@/lib/utils/storage';
import { invalidMediaRefs } from '@/features/media/server';
import type { Json } from '@/types/database';
import { saveSiteSchema, type SaveSiteInput } from './schema';

/**
 * Guarda el sitio (tema, navegación y páginas) en una sola transacción.
 * Valida con Zod, verifica que todas las imágenes referenciadas sean del
 * negocio y delega en la RPC save_site (RLS aplica a cada fila).
 */
export async function saveSite(input: SaveSiteInput): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail('Sólo el dueño o un administrador puede editar el sitio.');

  const parsed = saveSiteSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message && !issue.message.startsWith('Invalid') ? issue.message : 'Revisa los datos del sitio: hay un valor inválido.');
  }
  const { theme, navigation, pages, deletedPageIds } = parsed.data;

  // Imágenes: archivos del negocio o URLs externas registradas en su biblioteca.
  if ((await invalidMediaRefs(ctx, collectMediaPaths({ theme, pages }))).length > 0) return fail('Una de las imágenes no es válida. Elígela de nuevo desde la biblioteca.');

  const { error } = await ctx.supabase.rpc('save_site', {
    p_catalog_id: ctx.catalog.id,
    p_theme: (theme as Json) ?? null,
    p_navigation: (navigation as Json) ?? null,
    p_pages: pages ? (pages.map(pageToRow) as unknown as Json) : null,
    p_deleted_page_ids: deletedPageIds,
  });
  if (error) {
    if (error.message.includes('catalog_pages_slug_key')) return fail('Hay dos páginas con la misma dirección.');
    if (error.message.includes('home_required')) return fail('Elige una página de inicio.');
    if (error.message.includes('page_conflict')) return fail('Otra persona modificó el sitio. Recarga la página.');
    return fail(dbErrorMessage(error, 'No se pudo guardar el sitio.'));
  }

  invalidatePublicCatalog(ctx.business.slug);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, 'Sitio guardado');
}
