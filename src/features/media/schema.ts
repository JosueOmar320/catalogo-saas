import { z } from 'zod';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Tamaño máximo del archivo original que elige el usuario (se comprime antes de subir). */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
/** Límite del bucket (debe coincidir con la migración). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Imagen ya subida a Storage que el cliente pide registrar. */
export const uploadedImageSchema = z.object({
  id: z.uuid().optional(),
  path: z.string().min(1).max(300),
  thumbPath: z.string().max(300).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES).nullable(),
  mimeType: z.enum(ACCEPTED_IMAGE_TYPES).nullable(),
  alt: z.string().trim().max(200).default(''),
});

export type UploadedImage = z.input<typeof uploadedImageSchema>;
