import { env } from '@/lib/env';

/** URL pública de un archivo del bucket (el bucket es público). */
export function publicStorageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/storage/v1/object/public/${env.storageBucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Carpetas físicas. Las nuevas subidas van a `media/`; las demás existen por compatibilidad. */
export const MEDIA_KINDS = ['logo', 'cover', 'favicon', 'category', 'items', 'og', 'site', 'media'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Verifica que una ruta pertenezca al negocio (primer segmento = business_id).
 * Cualquier carpeta sirve para cualquier uso: una imagen se reutiliza sin copiarla.
 */
export function isPathOwnedBy(path: string, businessId: string, kind?: MediaKind): boolean {
  const [owner, folder, file] = path.split('/');
  if (owner !== businessId || !file || path.includes('..')) return false;
  return kind ? folder === kind : (MEDIA_KINDS as readonly string[]).includes(folder);
}

/** Referencia a una imagen externa (registrada en la biblioteca como `storage_provider = 'external'`). */
export function isExternalMediaUrl(ref: string | null | undefined): ref is string {
  return typeof ref === 'string' && /^https:\/\//.test(ref);
}

/**
 * URL de una imagen referenciada por el contenido: clave de Storage del
 * negocio o URL externa registrada en la biblioteca (el servidor rechaza
 * cualquier otra cosa al guardar).
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : publicStorageUrl(path);
}

/** Todas las rutas de imagen dentro de un objeto JSON (claves "path", "photo", "imagePath", "ogImagePath"). */
export function collectMediaPaths(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => collectMediaPaths(v, out));
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string' && v && ['path', 'photo', 'imagePath', 'ogImagePath'].includes(key)) out.push(v);
      else collectMediaPaths(v, out);
    }
  }
  return out;
}
