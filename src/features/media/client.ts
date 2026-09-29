'use client';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import type { MediaKind } from '@/lib/utils/storage';
import { registerMedia } from './actions';
import { ACCEPTED_IMAGE_TYPES, MAX_SOURCE_BYTES, MAX_UPLOAD_BYTES, type UploadedImage } from './schema';

/** Tamaños por tipo de imagen: [lado mayor, miniatura | null, conservar transparencia]. */
const PROFILES: Record<MediaKind, { max: number; thumb: number | null; keepAlpha: boolean }> = {
  items: { max: 1600, thumb: 480, keepAlpha: false },
  category: { max: 1200, thumb: null, keepAlpha: false },
  cover: { max: 2000, thumb: null, keepAlpha: false },
  og: { max: 1200, thumb: null, keepAlpha: false },
  site: { max: 2000, thumb: null, keepAlpha: true },
  logo: { max: 512, thumb: null, keepAlpha: true },
  favicon: { max: 256, thumb: null, keepAlpha: true },
};

export class UploadError extends Error {}

export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Formato no soportado. Usa JPG, PNG o WebP.';
  if (file.size > MAX_SOURCE_BYTES) return 'La imagen pesa más de 15 MB.';
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
  if (!context) throw new UploadError('Tu navegador no pudo procesar la imagen.');
  if (type === 'image/jpeg') {
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.84));
  if (!blob) throw new UploadError('No se pudo comprimir la imagen.');
  return { blob, width, height };
}

/**
 * Redimensiona y comprime en el navegador, y sube directo a Supabase Storage
 * (sin pasar por el servidor: evita el límite de body de Vercel).
 * Salida JPEG (o PNG si hay transparencia), compatible con el PDF.
 */
export async function uploadImage(file: File, businessId: string, kind: MediaKind, upload: { source?: 'upload' | 'chat' } = {}): Promise<UploadedImage> {
  const invalid = validateImageFile(file);
  if (invalid) throw new UploadError(invalid);

  const profile = PROFILES[kind];
  const type = profile.keepAlpha && (file.type === 'image/png' || (kind !== 'site' && file.type === 'image/webp')) ? 'image/png' : 'image/jpeg';
  const extension = type === 'image/png' ? 'png' : 'jpg';
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new UploadError('No se pudo leer la imagen.');
  });

  try {
    const full = await encode(bitmap, profile.max, type);
    if (full.blob.size > MAX_UPLOAD_BYTES) throw new UploadError('La imagen sigue siendo muy pesada tras comprimirla.');
    const thumb = profile.thumb ? await encode(bitmap, profile.thumb, type) : null;

    const bucket = createClient().storage.from(env.storageBucket);
    const id = crypto.randomUUID();
    const path = `${businessId}/${kind}/${id}.${extension}`;
    const thumbPath = thumb ? `${businessId}/${kind}/${id}-thumb.${extension}` : null;
    const options = { contentType: type, cacheControl: '31536000', upsert: false };

    const { error } = await bucket.upload(path, full.blob, options);
    if (error) throw new UploadError('No se pudo subir la imagen. Revisa tu conexión.');
    if (thumb && thumbPath) {
      const { error: thumbError } = await bucket.upload(thumbPath, thumb.blob, options);
      if (thumbError) {
        await bucket.remove([path]);
        throw new UploadError('No se pudo subir la imagen. Revisa tu conexión.');
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
    // Biblioteca de medios (para reutilizarla en el editor y que Garfield la encuentre). Si falla, la imagen igual sirve.
    await registerMedia({ ...uploaded, kind, source: upload.source }).catch(() => null);
    return uploaded;
  } finally {
    bitmap.close();
  }
}
