'use client';

import { msg } from '@/i18n/translate';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import type { MediaKind } from '@/lib/utils/storage';
import type { MediaFolder } from '@/types/database';
import { registerMedia } from './actions';
import { ACCEPTED_IMAGE_TYPES, MAX_SOURCE_BYTES, MAX_UPLOAD_BYTES, type UploadedImage } from './schema';

/**
 * Tamaños por uso: lado mayor de la imagen principal y si conserva
 * transparencia. Todas generan miniatura (480 px) para la biblioteca y el PDF.
 */
const PROFILES: Record<MediaKind, { max: number; keepAlpha: boolean }> = {
  items: { max: 1600, keepAlpha: false },
  category: { max: 1600, keepAlpha: false },
  cover: { max: 2000, keepAlpha: false },
  og: { max: 1200, keepAlpha: false },
  site: { max: 2000, keepAlpha: true },
  media: { max: 2000, keepAlpha: true },
  logo: { max: 1024, keepAlpha: true },
  favicon: { max: 512, keepAlpha: true },
};
const THUMB_SIDE = 480;

/** Carpeta de la biblioteca según desde dónde se subió. */
export const FOLDER_FOR_KIND: Record<MediaKind, MediaFolder> = {
  items: 'products',
  category: 'products',
  cover: 'banners',
  og: 'other',
  site: 'images',
  media: 'images',
  logo: 'logos',
  favicon: 'logos',
};

export class UploadError extends Error {}

export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return msg('Formato no soportado. Usa JPG, PNG o WebP.');
  if (file.size > MAX_SOURCE_BYTES) return msg('La imagen pesa más de 15 MB.');
  return null;
}

async function encode(bitmap: ImageBitmap, maxSide: number, type: 'image/jpeg' | 'image/png') {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new UploadError(msg('Tu navegador no pudo procesar la imagen.'));
  if (type === 'image/jpeg') {
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.84));
  if (!blob) throw new UploadError(msg('No se pudo comprimir la imagen.'));
  return { blob, width, height };
}

/**
 * Redimensiona y comprime en el navegador, y sube directo a Storage (sin
 * pasar por el servidor: evita el límite de body de Vercel). Salida JPEG (o
 * PNG si hay transparencia), compatible con el PDF. Todo queda en
 * `{negocio}/media/` y se registra en la biblioteca: se reutiliza en
 * cualquier lugar sin copiar el archivo.
 */
export async function uploadImage(file: File, businessId: string, kind: MediaKind, upload: { source?: 'upload' | 'chat'; folder?: MediaFolder; register?: boolean } = {}): Promise<UploadedImage & { mediaId: string | null }> {
  const invalid = validateImageFile(file);
  if (invalid) throw new UploadError(invalid);

  const profile = PROFILES[kind];
  const type = profile.keepAlpha && (file.type === 'image/png' || (kind !== 'site' && file.type === 'image/webp')) ? 'image/png' : 'image/jpeg';
  const extension = type === 'image/png' ? 'png' : 'jpg';
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new UploadError(msg('No se pudo leer la imagen.'));
  });

  try {
    const full = await encode(bitmap, profile.max, type);
    if (full.blob.size > MAX_UPLOAD_BYTES) throw new UploadError(msg('La imagen sigue siendo muy pesada tras comprimirla.'));
    const thumb = Math.max(full.width, full.height) > THUMB_SIDE * 1.2 ? await encode(bitmap, THUMB_SIDE, type) : null;

    const bucket = createClient().storage.from(env.storageBucket);
    const id = crypto.randomUUID();
    const path = `${businessId}/media/${id}.${extension}`;
    const thumbPath = thumb ? `${businessId}/media/${id}-thumb.${extension}` : null;
    const options = { contentType: type, cacheControl: '31536000', upsert: false };

    const { error } = await bucket.upload(path, full.blob, options);
    if (error) throw new UploadError(msg('No se pudo subir la imagen. Revisa tu conexión.'));
    if (thumb && thumbPath) {
      const { error: thumbError } = await bucket.upload(thumbPath, thumb.blob, options);
      if (thumbError) {
        await bucket.remove([path]);
        throw new UploadError(msg('No se pudo subir la imagen. Revisa tu conexión.'));
      }
    }

    const uploaded: UploadedImage = {
      path,
      thumbPath,
      width: full.width,
      height: full.height,
      sizeBytes: full.blob.size,
      mimeType: type,
      alt: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 120),
    };
    // Biblioteca de medios (para reutilizarla y que Garfield la encuentre). Si falla, la imagen igual sirve.
    // Al reemplazar una imagen no se registra (el registro existente pasa a apuntar al archivo nuevo).
    if (upload.register === false) return { ...uploaded, mediaId: null };
    const registered = await registerMedia({ ...uploaded, kind, source: upload.source, folder: upload.folder ?? FOLDER_FOR_KIND[kind], originalName: file.name.slice(0, 255) }).catch(() => null);
    return { ...uploaded, mediaId: registered?.ok ? registered.data.id : null };
  } finally {
    bitmap.close();
  }
}
