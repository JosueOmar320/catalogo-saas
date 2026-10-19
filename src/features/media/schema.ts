import { z } from 'zod';
import { msg } from '@/i18n/translate';
import type { MediaFolder, MediaSource, StorageProviderId } from '@/types/database';

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

/* ------------------------------------------------------------ Biblioteca */

export const MEDIA_FOLDERS = ['images', 'logos', 'products', 'backgrounds', 'banners', 'other'] as const satisfies readonly MediaFolder[];
export const MEDIA_FOLDER_LABELS: Record<MediaFolder, string> = {
  images: msg('Imágenes'),
  logos: msg('Logos'),
  products: msg('Productos'),
  backgrounds: msg('Fondos'),
  banners: msg('Banners'),
  other: msg('Otros'),
};
export const MEDIA_SOURCE_LABELS: Record<MediaSource, string> = { upload: msg('Subida'), import: msg('Importada'), stock: msg('Banco libre'), chat: msg('Chat de Garfield') };
export const MEDIA_SORTS = ['recent', 'oldest', 'name', 'size'] as const;
export type MediaSort = (typeof MEDIA_SORTS)[number];

/** Imagen de la biblioteca tal como la ve la interfaz. */
export type MediaRecord = {
  id: string;
  /** Referencia que se guarda en el contenido: clave de Storage o URL externa. */
  path: string;
  name: string;
  alt: string;
  folder: MediaFolder;
  source: MediaSource;
  provider: StorageProviderId;
  url: string;
  thumbUrl: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  mimeType: string | null;
  originalName: string | null;
  sourceUrl: string | null;
  attribution: string | null;
  createdAt: string;
};

export const mediaFiltersSchema = z.object({
  query: z.string().trim().max(80).default(''),
  folder: z.union([z.enum(MEDIA_FOLDERS), z.literal('all')]).default('all'),
  source: z.union([z.enum(['upload', 'import', 'stock', 'chat', 'external']), z.literal('all')]).default('all'),
  sort: z.enum(MEDIA_SORTS).default('recent'),
  /** Sólo archivos guardados en Storage (sin enlaces externos), p. ej. para elegir un logo. */
  storedOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(60),
  offset: z.number().int().min(0).max(100_000).default(0),
});
export type MediaFilters = z.input<typeof mediaFiltersSchema>;

export const mediaPatchSchema = z.object({
  name: z.string().trim().min(1, msg('Ponle un nombre')).max(200).optional(),
  alt: z.string().trim().max(200).optional(),
  folder: z.enum(MEDIA_FOLDERS).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
});
export type MediaPatch = z.input<typeof mediaPatchSchema>;

export const addFromUrlSchema = z.object({
  url: z.url({ protocol: /^https$/, error: msg('Usa una URL https') }).max(1000),
  mode: z.enum(['import', 'external']).default('import'),
  name: z.string().trim().max(200).default(''),
  alt: z.string().trim().max(200).default(''),
  folder: z.enum(MEDIA_FOLDERS).default('images'),
});
export type AddFromUrlInput = z.input<typeof addFromUrlSchema>;
