'use server';

import { z } from 'zod';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { afterCatalogChange } from '@/lib/catalog/cache';
import { cleanCustomHtmlSource } from '@/lib/site/custom-code';
import { pageToRow, type SitePage } from '@/lib/site/pages';
import { sectionSchema, type Section } from '@/lib/site/section-schemas';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { collectMediaPaths } from '@/lib/utils/storage';
import { invalidMediaRefs } from '@/features/media/server';
import type { Json } from '@/types/database';
import { getSiteVersion, toSectionTemplate, type SectionTemplate } from './queries';
import { saveSiteSchema, type SaveSiteInput } from './schema';

/** El HTML propio se guarda ya limpio (y se vuelve a limpiar al mostrarlo). */
function cleanCustomHtml(page: SitePage): SitePage {
  return { ...page, sections: page.sections.map((section) => (section.type === 'html' ? { ...section, content: { ...section.content, html: cleanCustomHtmlSource(section.content.html) } } : section)) };
}

/** Versión del sitio tal como la devuelve site_version (timestamp ISO). */
const versionSchema = z.string().max(60).refine((v) => !Number.isNaN(Date.parse(v))).nullable();

/**
 * Guarda el sitio (tema, navegación y páginas) en una sola transacción.
 * Valida con Zod, verifica que todas las imágenes referenciadas sean del
 * negocio y delega en la RPC save_site (RLS aplica a cada fila).
 * `expectedVersion`: la versión que cargó el editor; si otra persona guardó
 * después, la base responde `site_changed` y no se pisa nada. Devuelve la
 * versión nueva para el siguiente guardado.
 */
export async function saveSite(input: SaveSiteInput, expectedVersion: string | null = null): Promise<ActionResult<{ version: string | null }>> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede editar el sitio.'));

  const version = versionSchema.safeParse(expectedVersion);
  if (!version.success) return fail(msg('Revisa los datos del sitio: hay un valor inválido.'));
  const parsed = saveSiteSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Los mensajes propios del esquema pueden llevar datos (params): se traducen aquí con ellos.
    const t = await getT();
    return fail(issue?.message && !issue.message.startsWith('Invalid') ? t(issue.message, issue.code === 'custom' ? issue.params : undefined) : msg('Revisa los datos del sitio: hay un valor inválido.'));
  }
  const { theme, navigation, deletedPageIds } = parsed.data;
  const pages = parsed.data.pages?.map(cleanCustomHtml);

  // Imágenes: archivos del negocio o URLs externas registradas en su biblioteca.
  if ((await invalidMediaRefs(ctx, collectMediaPaths({ theme, pages }))).length > 0) return fail(msg('Una de las imágenes no es válida. Elígela de nuevo desde la biblioteca.'));

  const { error } = await ctx.supabase.rpc('save_site', {
    p_catalog_id: ctx.catalog.id,
    p_theme: (theme as Json) ?? null,
    p_navigation: (navigation as Json) ?? null,
    p_pages: pages ? (pages.map(pageToRow) as unknown as Json) : null,
    p_deleted_page_ids: deletedPageIds,
    p_expected_version: version.data,
  });
  if (error) {
    if (error.message.includes('catalog_pages_slug_key')) return fail(msg('Hay dos páginas con la misma dirección.'));
    if (error.message.includes('home_required')) return fail(msg('Elige una página de inicio.'));
    if (error.message.includes('page_conflict') || error.message.includes('site_changed')) return fail(msg('Otra persona modificó el sitio. Recarga la página.'));
    return fail(dbErrorMessage(error, msg('No se pudo guardar el sitio.')));
  }

  afterCatalogChange(ctx);
  return ok({ version: await getSiteVersion(ctx) }, msg('Sitio guardado'));
}

/** "Guardar como plantilla": copia la sección para reusarla en otras páginas. */
export async function saveSectionTemplate(name: string, section: Section): Promise<ActionResult<SectionTemplate>> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede editar el sitio.'));
  const cleanName = name.trim().slice(0, 60);
  if (!cleanName) return fail(msg('Escribe un nombre'));
  const parsed = sectionSchema.safeParse(section);
  if (!parsed.success) return fail(msg('Revisa los datos de la sección: hay un valor inválido.'));
  if ((await invalidMediaRefs(ctx, collectMediaPaths(parsed.data))).length > 0) return fail(msg('Una de las imágenes no es válida. Elígela de nuevo desde la biblioteca.'));

  const { data, error } = await ctx.supabase
    .from('section_templates')
    .insert({ business_id: ctx.business.id, name: cleanName, section: parsed.data as unknown as Json })
    .select('id, name, section')
    .single();
  if (error?.message.includes('section_template_limit_reached')) return fail(msg('Llegaste al máximo de 50 plantillas. Borra alguna para guardar otra.'));
  const template = data && toSectionTemplate(data);
  if (error || !template) return fail(dbErrorMessage(error, msg('No se pudo guardar la plantilla.')));
  return ok(template, msg('Plantilla guardada'));
}

export async function deleteSectionTemplate(id: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede editar el sitio.'));
  const { error } = await ctx.supabase.from('section_templates').delete().eq('id', id).eq('business_id', ctx.business.id);
  if (error) return fail(dbErrorMessage(error, msg('No se pudo borrar la plantilla.')));
  return ok(undefined, msg('Plantilla borrada'));
}
