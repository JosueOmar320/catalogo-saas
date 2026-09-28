import { env } from '@/lib/env';

/** URL pública de un archivo del bucket (el bucket es público). */
export function publicStorageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/storage/v1/object/public/${env.storageBucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export const MEDIA_KINDS = ['logo', 'cover', 'favicon', 'category', 'items', 'og', 'site'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Verifica que una ruta pertenezca al negocio (primer segmento = business_id). */
export function isPathOwnedBy(path: string, businessId: string, kind?: MediaKind): boolean {
  const [owner, folder, file] = path.split('/');
  if (owner !== businessId || !file || path.includes('..')) return false;
  return kind ? folder === kind : (MEDIA_KINDS as readonly string[]).includes(folder);
}

/**
 * URL de una imagen referenciada por el sitio. Las rutas son de Storage; las
 * URLs absolutas sólo aparecen en datos de ejemplo (el servidor rechaza
 * guardar rutas ajenas al negocio).
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
