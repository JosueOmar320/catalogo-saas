'use server';

import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { dropMediaRefs, parseSiteSnapshot, type SiteSnapshot, type SiteVersionSummary } from '@/lib/site/versions';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { collectMediaPaths } from '@/lib/utils/storage';
import { invalidMediaRefs } from '@/features/media/server';

/** Versiones que se listan (la base conserva como mucho ~110 por sitio). */
const LIST_LIMIT = 120;
const NOT_ALLOWED = msg('Sólo el dueño o un administrador puede editar el sitio.');
const labelSchema = z.string().trim().min(1, msg('Escribe un nombre')).max(80, msg('Máximo 80 caracteres'));

async function managerContext() {
  const ctx = await requireBusinessContext();
  return canManageCatalog(ctx) ? ctx : null;
}

/** Historial del sitio, de la más reciente a la más antigua (sin las copias: se cargan al abrir una). */
export async function listSiteVersions(): Promise<ActionResult<SiteVersionSummary[]>> {
  const ctx = await managerContext();
  if (!ctx) return fail(NOT_ALLOWED);
  const { data, error } = await ctx.supabase
    .from('site_versions')
    .select('id, label, author_name, created_at, page_count')
    .eq('catalog_id', ctx.catalog.id)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) return fail(dbErrorMessage(error, msg('No se pudo cargar el historial.')));
  return ok(data.map((row) => ({ id: row.id, label: row.label, author: row.author_name, createdAt: row.created_at, pageCount: row.page_count })));
}

/**
 * Una versión lista para el editor. Las imágenes que ya no están en la
 * biblioteca se quitan (si no, el guardado la rechazaría).
 */
export async function openSiteVersion(id: string): Promise<ActionResult<{ snapshot: SiteSnapshot; missingImages: number }>> {
  const ctx = await managerContext();
  if (!ctx) return fail(NOT_ALLOWED);
  if (!z.uuid().safeParse(id).success) return fail(msg('No se encontró esa versión.'));
  const { data, error } = await ctx.supabase.from('site_versions').select('snapshot').eq('id', id).eq('catalog_id', ctx.catalog.id).maybeSingle();
  if (error) return fail(dbErrorMessage(error, msg('No se pudo abrir la versión.')));
  const snapshot = data && parseSiteSnapshot(data.snapshot);
  if (!snapshot) return fail(msg('No se encontró esa versión.'));
  const invalid = new Set(await invalidMediaRefs(ctx, collectMediaPaths(snapshot)));
  return ok({ snapshot: dropMediaRefs(snapshot, invalid), missingImages: invalid.size });
}

/** "Guardar versión": copia con nombre del sitio tal como está guardado. */
export async function nameSiteVersion(label: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await managerContext();
  if (!ctx) return fail(NOT_ALLOWED);
  const parsed = labelSchema.safeParse(label);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { data, error } = await ctx.supabase.rpc('record_site_version', { p_catalog_id: ctx.catalog.id, p_label: parsed.data });
  if (error?.message.includes('version_limit')) return fail(msg('Llegaste al máximo de 20 versiones con nombre. Borra alguna para guardar otra.'));
  if (error?.message.includes('version_too_large')) return fail(msg('El sitio es demasiado grande para guardarlo como versión.'));
  if (error || !data) return fail(dbErrorMessage(error, msg('Guarda tu sitio antes de crear una versión.')));
  return ok({ id: data }, msg('Versión guardada'));
}

export async function renameSiteVersion(id: string, label: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail(NOT_ALLOWED);
  const parsed = labelSchema.safeParse(label);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { error } = await ctx.supabase.from('site_versions').update({ label: parsed.data }).eq('id', id).eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error, msg('No se pudo cambiar el nombre.')));
  return ok(undefined, msg('Nombre guardado'));
}

export async function deleteSiteVersion(id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail(NOT_ALLOWED);
  const { error } = await ctx.supabase.from('site_versions').delete().eq('id', id).eq('catalog_id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error, msg('No se pudo borrar la versión.')));
  return ok(undefined, msg('Versión borrada'));
}
