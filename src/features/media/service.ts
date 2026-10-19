import 'server-only';
import { readBodyCapped, safeDownload, SafeFetchError } from '@/lib/net/safe-fetch';
import { supabaseStorage, type StorageProvider } from '@/lib/storage/provider';
import type { ServerSupabase } from '@/lib/supabase/server';
import { isExternalMediaUrl, isPathOwnedBy, publicStorageUrl } from '@/lib/utils/storage';
import type { MediaFolder, MediaSource, Tables } from '@/types/database';
import { processImage } from './process';
import { mediaFiltersSchema, type MediaFilters, type MediaPatch, type MediaRecord } from './schema';

/**
 * MediaService: reglas de la biblioteca de medios. Lo usan las Server
 * Actions de la biblioteca y las herramientas de Garfield. Trabaja con la
 * sesión del usuario (RLS) y sobre UN negocio.
 *
 *   MediaService → StorageProvider (Supabase hoy) → bytes
 *              └→ media_assets (metadatos y referencias)
 */

export type MediaScope = { supabase: ServerSupabase; businessId: string; storage?: StorageProvider };
export class MediaError extends Error {}

type Row = Tables<'media_assets'>;
const COLUMNS = 'id, path, thumb_path, name, alt, folder, source, storage_provider, public_url, width, height, size_bytes, mime_type, original_name, source_url, attribution, created_at';

const storageOf = (scope: MediaScope) => scope.storage ?? supabaseStorage(scope.supabase);

export function toMediaRecord(row: Pick<Row, 'id' | 'path' | 'thumb_path' | 'name' | 'alt' | 'folder' | 'source' | 'storage_provider' | 'public_url' | 'width' | 'height' | 'size_bytes' | 'mime_type' | 'original_name' | 'source_url' | 'attribution' | 'created_at'>): MediaRecord {
  const external = row.storage_provider === 'external';
  const url = external ? (row.public_url ?? row.path) : (publicStorageUrl(row.path) ?? '');
  return {
    id: row.id,
    path: row.path,
    name: row.name || row.alt || 'Sin nombre',
    alt: row.alt,
    folder: row.folder,
    source: row.source,
    provider: row.storage_provider,
    url,
    thumbUrl: external ? url : (publicStorageUrl(row.thumb_path ?? row.path) ?? url),
    thumbPath: row.thumb_path,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
    originalName: row.original_name,
    sourceUrl: row.source_url,
    attribution: row.attribution,
    createdAt: row.created_at,
  };
}

const clean = (value: string) => value.replace(/[%,()\\]/g, ' ').trim();

/* ------------------------------------------------------------ Consultas */

export async function listMedia(scope: MediaScope, raw: MediaFilters = {}): Promise<{ items: MediaRecord[]; total: number }> {
  const f = mediaFiltersSchema.parse(raw);
  let query = scope.supabase.from('media_assets').select(COLUMNS, { count: 'exact' }).eq('business_id', scope.businessId).is('deleted_at', null);
  if (f.folder !== 'all') query = query.eq('folder', f.folder);
  if (f.source === 'external') query = query.eq('storage_provider', 'external');
  else if (f.source !== 'all') query = query.eq('source', f.source);
  if (f.storedOnly) query = query.neq('storage_provider', 'external');
  const words = clean(f.query).split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
  for (const word of words) query = query.or(`name.ilike.%${word}%,alt.ilike.%${word}%,original_name.ilike.%${word}%`);
  query =
    f.sort === 'name' ? query.order('name', { ascending: true }) : f.sort === 'size' ? query.order('size_bytes', { ascending: false, nullsFirst: false }) : query.order('created_at', { ascending: f.sort === 'oldest' });
  const { data, count, error } = await query.range(f.offset, f.offset + f.limit - 1);
  if (error) throw new MediaError('No se pudo cargar la biblioteca.');
  return { items: (data ?? []).map(toMediaRecord), total: count ?? 0 };
}

/**
 * Búsqueda para Garfield (también en modo local): palabras en nombre, alt o
 * nombre original; si no hay coincidencias por todas las palabras, por
 * cualquiera. Opcionalmente por carpeta.
 */
export async function findMedia(scope: MediaScope, opts: { query?: string; folder?: MediaFolder; limit?: number; latest?: boolean } = {}): Promise<MediaRecord[]> {
  const limit = Math.min(opts.limit ?? 8, 40);
  const words = clean(opts.query ?? '').toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 5);
  const base = () => {
    let q = scope.supabase.from('media_assets').select(COLUMNS).eq('business_id', scope.businessId).is('deleted_at', null);
    if (opts.folder) q = q.eq('folder', opts.folder);
    return q.order('created_at', { ascending: false }).limit(limit);
  };
  if (words.length === 0) {
    const { data } = await base();
    return (data ?? []).map(toMediaRecord);
  }
  const anyWord = words.map((w) => `name.ilike.%${w}%,alt.ilike.%${w}%,original_name.ilike.%${w}%,attribution.ilike.%${w}%`).join(',');
  const { data } = await base().or(anyWord);
  const records = (data ?? []).map(toMediaRecord);
  // Primero las que contienen MÁS palabras.
  const score = (m: MediaRecord) => words.filter((w) => `${m.name} ${m.alt} ${m.originalName ?? ''} ${m.attribution ?? ''}`.toLowerCase().includes(w)).length;
  return records.sort((a, b) => score(b) - score(a));
}

export async function getMedia(scope: MediaScope, id: string): Promise<Row | null> {
  const { data } = await scope.supabase.from('media_assets').select('*').eq('business_id', scope.businessId).eq('id', id).is('deleted_at', null).maybeSingle();
  return data;
}

export async function mediaReferences(scope: MediaScope, path: string): Promise<{ place: string; label: string }[]> {
  const { data, error } = await scope.supabase.rpc('media_references', { p_business: scope.businessId, p_path: path });
  if (error) throw new MediaError('No se pudo revisar dónde se usa la imagen.');
  return (data ?? []).map((r) => ({ place: r.place, label: r.label }));
}

/* ------------------------------------------------------------ Altas */

type NewMediaMeta = { name?: string; alt?: string; folder?: MediaFolder; source: MediaSource; sourceUrl?: string | null; attribution?: string | null; originalName?: string | null };

/** Bytes de terceros → sharp (principal + miniatura) → Storage → biblioteca. */
export async function storeImage(scope: MediaScope, bytes: Uint8Array, meta: NewMediaMeta): Promise<MediaRecord> {
  let processed;
  try {
    processed = await processImage(bytes);
  } catch {
    throw new MediaError('No se pudo procesar la imagen.');
  }
  const storage = storageOf(scope);
  const id = crypto.randomUUID();
  const path = `${scope.businessId}/media/${id}.${processed.main.extension}`;
  const thumbPath = processed.thumb ? `${scope.businessId}/media/${id}-thumb.${processed.thumb.extension}` : null;
  await storage.upload(path, processed.main.data, processed.main.mime);
  if (processed.thumb && thumbPath) {
    try {
      await storage.upload(thumbPath, processed.thumb.data, processed.thumb.mime);
    } catch (error) {
      await storage.remove([path]);
      throw error;
    }
  }
  const { data, error } = await scope.supabase
    .from('media_assets')
    .insert({
      business_id: scope.businessId,
      path,
      thumb_path: thumbPath,
      kind: 'media',
      folder: meta.folder ?? 'images',
      name: (meta.name || meta.alt || meta.originalName || 'Imagen').slice(0, 200),
      alt: (meta.alt ?? '').slice(0, 200),
      original_name: meta.originalName?.slice(0, 255) ?? null,
      mime_type: processed.main.mime,
      width: processed.main.width,
      height: processed.main.height,
      size_bytes: processed.main.data.byteLength,
      source: meta.source,
      source_url: meta.sourceUrl?.slice(0, 1000) ?? null,
      attribution: meta.attribution?.slice(0, 300) ?? null,
      storage_provider: 'supabase',
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    await storage.remove([path, ...(thumbPath ? [thumbPath] : [])]);
    throw new MediaError('No se pudo registrar la imagen.');
  }
  return toMediaRecord(data);
}

function fileNameFrom(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 120);
  } catch {
    return '';
  }
}

/** "Agregar desde URL → Importar": descarga segura y copia a Storage propio. */
export async function importFromUrl(scope: MediaScope, url: string, meta: Omit<NewMediaMeta, 'source'> & { source?: MediaSource }, fetchImpl?: typeof fetch): Promise<MediaRecord> {
  const image = await download(url, fetchImpl);
  return storeImage(scope, image.data, { ...meta, source: meta.source ?? 'import', sourceUrl: meta.sourceUrl ?? url, originalName: meta.originalName ?? fileNameFrom(url) });
}

/**
 * "Agregar desde URL → Usar enlace externo": se verifica que la URL sea una
 * imagen pública (misma descarga segura) y se guarda SÓLO la referencia.
 */
export async function addExternal(scope: MediaScope, url: string, meta: Omit<NewMediaMeta, 'source'>, fetchImpl?: typeof fetch): Promise<MediaRecord> {
  const image = await download(url, fetchImpl);
  const name = (meta.name || meta.alt || fileNameFrom(url) || 'Imagen externa').slice(0, 200);
  const { data: existing } = await scope.supabase.from('media_assets').select('id').eq('business_id', scope.businessId).eq('path', url).maybeSingle();
  const values = {
    business_id: scope.businessId,
    path: url,
    public_url: url,
    storage_provider: 'external' as const,
    kind: 'media',
    folder: meta.folder ?? 'images',
    name,
    alt: (meta.alt ?? '').slice(0, 200),
    original_name: fileNameFrom(url) || null,
    mime_type: image.mime,
    width: image.width,
    height: image.height,
    size_bytes: image.data.byteLength,
    source: 'import' as const,
    source_url: url,
    deleted_at: null,
  };
  const query = existing ? scope.supabase.from('media_assets').update(values).eq('id', existing.id) : scope.supabase.from('media_assets').insert(values);
  const { data, error } = await query.select(COLUMNS).single();
  if (error || !data) throw new MediaError('No se pudo guardar la referencia.');
  return toMediaRecord(data);
}

async function download(url: string, fetchImpl?: typeof fetch) {
  try {
    return await safeDownload(url, fetchImpl);
  } catch (error) {
    throw new MediaError(error instanceof SafeFetchError ? error.message : 'No se pudo descargar la imagen.');
  }
}

/* ------------------------------------------------------------ Cambios */

export async function updateMedia(scope: MediaScope, id: string, patch: MediaPatch): Promise<MediaRecord> {
  const { data, error } = await scope.supabase.from('media_assets').update(patch).eq('business_id', scope.businessId).eq('id', id).is('deleted_at', null).select(COLUMNS).single();
  if (error || !data) throw new MediaError('No se pudo guardar.');
  return toMediaRecord(data);
}

export async function moveMedia(scope: MediaScope, ids: string[], folder: MediaFolder): Promise<number> {
  const { data, error } = await scope.supabase.from('media_assets').update({ folder }).eq('business_id', scope.businessId).in('id', ids.slice(0, 200)).is('deleted_at', null).select('id');
  if (error) throw new MediaError('No se pudo mover.');
  return data?.length ?? 0;
}

/**
 * Borrar: sólo lo que no se usa en ningún lado. Lo usado se devuelve con la
 * lista de lugares (la interfaz lo explica). El archivo se elimina de
 * Storage; el registro queda con deleted_at (auditoría).
 */
export async function deleteMedia(scope: MediaScope, ids: string[]): Promise<{ deleted: string[]; blocked: { id: string; name: string; usedIn: string[] }[] }> {
  const { data: rows } = await scope.supabase.from('media_assets').select('id, path, thumb_path, name, storage_provider').eq('business_id', scope.businessId).in('id', ids.slice(0, 200)).is('deleted_at', null);
  const deleted: string[] = [];
  const blocked: { id: string; name: string; usedIn: string[] }[] = [];
  const files: string[] = [];
  for (const row of rows ?? []) {
    const refs = await mediaReferences(scope, row.path);
    if (refs.length) {
      blocked.push({ id: row.id, name: row.name, usedIn: refs.map((r) => r.label) });
      continue;
    }
    const { error } = await scope.supabase.from('media_assets').update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
    if (error) continue;
    deleted.push(row.id);
    if (row.storage_provider === 'supabase') files.push(...[row.path, row.thumb_path].filter((p): p is string => Boolean(p) && isPathOwnedBy(p!, scope.businessId)));
  }
  await storageOf(scope).remove(files);
  return { deleted, blocked };
}

type NewFile = { path: string; thumbPath: string | null; width: number | null; height: number | null; sizeBytes: number | null; mimeType: string | null; originalName?: string | null };

/**
 * Reemplazar: el archivo nuevo ya está en Storage. Se reescriben TODAS las
 * referencias del negocio (secciones, tema, PDF, productos, logo…) y el
 * registro conserva su id, nombre y carpeta. El archivo viejo se borra.
 */
export async function replaceMediaFile(scope: MediaScope, id: string, file: NewFile): Promise<MediaRecord> {
  if (!isPathOwnedBy(file.path, scope.businessId) || (file.thumbPath && !isPathOwnedBy(file.thumbPath, scope.businessId))) throw new MediaError('Archivo inválido.');
  const current = await getMedia(scope, id);
  if (!current) throw new MediaError('La imagen ya no existe.');
  const { error: refError } = await scope.supabase.rpc('replace_media_references', { p_business: scope.businessId, p_old: current.path, p_new: file.path, p_new_thumb: file.thumbPath });
  if (refError) throw new MediaError('No se pudo actualizar dónde se usa la imagen.');
  const { data, error } = await scope.supabase
    .from('media_assets')
    .update({
      path: file.path,
      thumb_path: file.thumbPath,
      width: file.width,
      height: file.height,
      size_bytes: file.sizeBytes,
      mime_type: file.mimeType,
      original_name: file.originalName ?? current.original_name,
      storage_provider: 'supabase',
      public_url: null,
    })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error || !data) throw new MediaError('No se pudo reemplazar la imagen.');
  if (current.storage_provider === 'supabase') await storageOf(scope).remove([current.path, current.thumb_path].filter((p): p is string => Boolean(p) && p !== file.path && p !== file.thumbPath && isPathOwnedBy(p!, scope.businessId)));
  return toMediaRecord(data);
}

/** Imagen externa → copia propia (y todas sus referencias pasan a la copia). */
export async function importExternal(scope: MediaScope, id: string, fetchImpl?: typeof fetch): Promise<MediaRecord> {
  const current = await getMedia(scope, id);
  if (!current || current.storage_provider !== 'external' || !isExternalMediaUrl(current.path)) throw new MediaError('Esa imagen ya está en tu biblioteca.');
  const image = await download(current.path, fetchImpl);
  const processed = await processImage(image.data).catch(() => {
    throw new MediaError('No se pudo procesar la imagen.');
  });
  const storage = storageOf(scope);
  const key = crypto.randomUUID();
  const path = `${scope.businessId}/media/${key}.${processed.main.extension}`;
  const thumbPath = processed.thumb ? `${scope.businessId}/media/${key}-thumb.${processed.thumb.extension}` : null;
  await storage.upload(path, processed.main.data, processed.main.mime);
  if (processed.thumb && thumbPath) await storage.upload(thumbPath, processed.thumb.data, processed.thumb.mime);
  try {
    return await replaceMediaFile(scope, id, { path, thumbPath, width: processed.main.width, height: processed.main.height, sizeBytes: processed.main.data.byteLength, mimeType: processed.main.mime });
  } catch (error) {
    await storage.remove([path, ...(thumbPath ? [thumbPath] : [])]);
    throw error;
  }
}

/** Miniaturas para imágenes antiguas que no tenían (no toca el original). */
export async function generateMissingThumbnails(scope: MediaScope, limit = 12): Promise<{ done: number; remaining: number }> {
  const { data: rows, count } = await scope.supabase
    .from('media_assets')
    .select('id, path', { count: 'exact' })
    .eq('business_id', scope.businessId)
    .eq('storage_provider', 'supabase')
    .is('thumb_path', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  const storage = storageOf(scope);
  let done = 0;
  for (const row of rows ?? []) {
    const url = storage.publicUrl(row.path);
    if (!url) continue;
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) continue;
      const processed = await processImage(await readBodyCapped(response));
      // Imagen chica: no necesita miniatura; se marca con su propia ruta para no reintentar.
      const thumbPath = processed.thumb ? row.path.replace(/(\.[a-z0-9]+)?$/i, `-thumb.${processed.thumb.extension}`) : row.path;
      if (processed.thumb) await storage.upload(thumbPath, processed.thumb.data, processed.thumb.mime);
      await scope.supabase.from('media_assets').update({ thumb_path: thumbPath, width: processed.main.width, height: processed.main.height }).eq('id', row.id);
      done += 1;
    } catch {
      // Se reintenta la próxima vez.
    }
  }
  return { done, remaining: Math.max(0, (count ?? 0) - done) };
}
