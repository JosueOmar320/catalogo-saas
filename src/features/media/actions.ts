'use server';

import { z } from 'zod';
import { canManageCatalog, requireBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { afterCatalogChange } from '@/lib/catalog/cache';
import { msg } from '@/i18n/translate';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { isPathOwnedBy, type MediaKind } from '@/lib/utils/storage';
import type { MediaFolder } from '@/types/database';
import { addFromUrlSchema, MEDIA_FOLDERS, mediaFiltersSchema, mediaPatchSchema, uploadedImageSchema, type AddFromUrlInput, type MediaFilters, type MediaPatch, type MediaRecord, type UploadedImage } from './schema';
import * as media from './service';

/** Compatibilidad: selector de imágenes del editor. */
export type LibraryImage = MediaRecord;

const scopeOf = (ctx: BusinessContext): media.MediaScope => ({ supabase: ctx.supabase, businessId: ctx.business.id });
const idSchema = z.uuid();
const idsSchema = z.array(z.uuid()).min(1).max(200);

async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return ok(await fn(), message);
  } catch (error) {
    if (error instanceof media.MediaError) return fail(error.message);
    console.error('[media]', error);
    return fail(msg('Algo salió mal con la biblioteca. Intenta de nuevo.'));
  }
}

/** Cambios que afectan el sitio publicado (reemplazar, importar una externa). */
function contentChanged(ctx: BusinessContext) {
  afterCatalogChange(ctx);
}

/** Registra en la biblioteca una imagen recién subida a Storage (ruta del negocio actual). */
export async function registerMedia(input: UploadedImage & { kind: MediaKind; source?: 'upload' | 'chat'; folder?: MediaFolder; originalName?: string; name?: string }): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusinessContext();
  const parsed = uploadedImageSchema.safeParse(input);
  if (!parsed.success) return fail(msg('Imagen inválida.'));
  const image = parsed.data;
  if (!isPathOwnedBy(image.path, ctx.business.id) || (image.thumbPath && !isPathOwnedBy(image.thumbPath, ctx.business.id))) return fail(msg('Imagen inválida.'));
  const folder = (MEDIA_FOLDERS as readonly string[]).includes(input.folder ?? '') ? input.folder! : 'images';
  const name = (input.name || image.alt || input.originalName || 'Imagen').slice(0, 200);
  const { data, error } = await ctx.supabase
    .from('media_assets')
    .upsert(
      {
        business_id: ctx.business.id,
        path: image.path,
        thumb_path: image.thumbPath,
        kind: 'media',
        folder,
        name,
        original_name: input.originalName?.slice(0, 255) ?? null,
        width: image.width,
        height: image.height,
        size_bytes: image.sizeBytes,
        mime_type: image.mimeType,
        alt: image.alt,
        source: input.source === 'chat' ? 'chat' : 'upload',
        storage_provider: 'supabase',
      },
      { onConflict: 'business_id,path' },
    )
    .select('id')
    .single();
  if (error || !data) return fail(msg('No se pudo registrar la imagen.'));
  return ok({ id: data.id });
}

export async function searchMediaPage(filters: MediaFilters): Promise<ActionResult<{ items: MediaRecord[]; total: number }>> {
  const ctx = await requireBusinessContext();
  const parsed = mediaFiltersSchema.safeParse(filters);
  if (!parsed.success) return fail(msg('Filtro inválido.'));
  return run(() => media.listMedia(scopeOf(ctx), parsed.data));
}

export async function addMediaFromUrl(input: AddFromUrlInput): Promise<ActionResult<MediaRecord>> {
  const ctx = await requireBusinessContext();
  const parsed = addFromUrlSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? msg('URL inválida.'));
  const { url, mode, ...meta } = parsed.data;
  return run(() => (mode === 'external' ? media.addExternal(scopeOf(ctx), url, meta) : media.importFromUrl(scopeOf(ctx), url, meta)), mode === 'external' ? msg('Enlace agregado a la biblioteca') : msg('Imagen importada'));
}

export async function updateMediaItem(id: string, patch: MediaPatch): Promise<ActionResult<MediaRecord>> {
  const ctx = await requireBusinessContext();
  const parsed = mediaPatchSchema.safeParse(patch);
  if (!idSchema.safeParse(id).success || !parsed.success) return fail(parsed.error?.issues[0]?.message ?? msg('Datos inválidos.'));
  return run(() => media.updateMedia(scopeOf(ctx), id, parsed.data), msg('Guardado'));
}

export async function moveMediaItems(ids: string[], folder: MediaFolder): Promise<ActionResult<number>> {
  const ctx = await requireBusinessContext();
  if (!idsSchema.safeParse(ids).success || !(MEDIA_FOLDERS as readonly string[]).includes(folder)) return fail(msg('Datos inválidos.'));
  return run(() => media.moveMedia(scopeOf(ctx), ids, folder), msg('Movidas'));
}

export async function mediaUsage(id: string): Promise<ActionResult<{ place: string; label: string }[]>> {
  const ctx = await requireBusinessContext();
  if (!idSchema.safeParse(id).success) return fail(msg('Imagen inválida.'));
  return run(async () => {
    const row = await media.getMedia(scopeOf(ctx), id);
    if (!row) throw new media.MediaError(msg('La imagen ya no existe.'));
    return media.mediaReferences(scopeOf(ctx), row.path);
  });
}

export async function deleteMediaItems(ids: string[]): Promise<ActionResult<{ deleted: string[]; blocked: { id: string; name: string; usedIn: string[] }[] }>> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede borrar imágenes.'));
  if (!idsSchema.safeParse(ids).success) return fail(msg('Datos inválidos.'));
  return run(() => media.deleteMedia(scopeOf(ctx), ids));
}

/** El archivo nuevo lo sube el navegador (sin registrarlo); aquí se cambia en todo el contenido. */
export async function replaceMediaItem(id: string, file: UploadedImage & { originalName?: string }): Promise<ActionResult<MediaRecord>> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede reemplazar imágenes.'));
  const parsed = uploadedImageSchema.safeParse(file);
  if (!idSchema.safeParse(id).success || !parsed.success) return fail(msg('Datos inválidos.'));
  const result = await run(() => media.replaceMediaFile(scopeOf(ctx), id, { ...parsed.data, originalName: file.originalName?.slice(0, 255) ?? null }), msg('Imagen reemplazada en todo el sitio'));
  if (result.ok) contentChanged(ctx);
  return result;
}

export async function importExternalMedia(id: string): Promise<ActionResult<MediaRecord>> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede hacer esto.'));
  if (!idSchema.safeParse(id).success) return fail(msg('Imagen inválida.'));
  const result = await run(() => media.importExternal(scopeOf(ctx), id), msg('Imagen copiada a tu biblioteca'));
  if (result.ok) contentChanged(ctx);
  return result;
}

export async function generateThumbnails(): Promise<ActionResult<{ done: number; remaining: number }>> {
  const ctx = await requireBusinessContext();
  return run(() => media.generateMissingThumbnails(scopeOf(ctx)));
}
