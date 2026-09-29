'use server';

import { requireBusinessContext } from '@/lib/auth/session';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { isPathOwnedBy, publicStorageUrl, type MediaKind } from '@/lib/utils/storage';
import { uploadedImageSchema, type UploadedImage } from './schema';

export type LibraryImage = { id: string; path: string; url: string; thumbUrl: string; alt: string; width: number | null; height: number | null; source: string };

const KINDS: MediaKind[] = ['items', 'category', 'cover', 'og', 'site', 'logo', 'favicon'];

/** Registra en la biblioteca una imagen recién subida a Storage (ruta del negocio actual). */
export async function registerMedia(input: UploadedImage & { kind: MediaKind; source?: 'upload' | 'chat' }): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusinessContext();
  const parsed = uploadedImageSchema.safeParse(input);
  if (!parsed.success || !KINDS.includes(input.kind)) return fail('Imagen inválida.');
  const image = parsed.data;
  if (!isPathOwnedBy(image.path, ctx.business.id) || (image.thumbPath && !isPathOwnedBy(image.thumbPath, ctx.business.id))) return fail('Imagen inválida.');
  const { data, error } = await ctx.supabase
    .from('media_assets')
    .upsert(
      {
        business_id: ctx.business.id,
        path: image.path,
        thumb_path: image.thumbPath,
        kind: input.kind,
        width: image.width,
        height: image.height,
        size_bytes: image.sizeBytes,
        mime_type: image.mimeType,
        alt: image.alt,
        source: input.source ?? 'upload',
      },
      { onConflict: 'path' },
    )
    .select('id')
    .single();
  if (error || !data) return fail('No se pudo registrar la imagen.');
  return ok({ id: data.id });
}

/** Biblioteca del negocio actual (más recientes primero). */
export async function listMediaLibrary(query = '', limit = 60): Promise<ActionResult<LibraryImage[]>> {
  const ctx = await requireBusinessContext();
  let request = ctx.supabase
    .from('media_assets')
    .select('id, path, thumb_path, alt, width, height, source')
    .eq('business_id', ctx.business.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 120));
  const q = query.trim().slice(0, 60);
  if (q) request = request.ilike('alt', `%${q}%`);
  const { data, error } = await request;
  if (error) return fail('No se pudo cargar la biblioteca.');
  return ok(
    (data ?? []).map((m) => ({
      id: m.id,
      path: m.path,
      url: publicStorageUrl(m.path)!,
      thumbUrl: publicStorageUrl(m.thumb_path ?? m.path)!,
      alt: m.alt,
      width: m.width,
      height: m.height,
      source: m.source,
    })),
  );
}
