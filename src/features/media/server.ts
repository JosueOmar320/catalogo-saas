import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { isPathOwnedBy, type MediaKind } from '@/lib/utils/storage';

/** Borra archivos del bucket. Sólo acepta rutas del negocio actual. */
export async function removeStorageObjects(ctx: BusinessContext, paths: (string | null | undefined)[]) {
  const owned = paths.filter((p): p is string => Boolean(p) && isPathOwnedBy(p!, ctx.business.id));
  if (owned.length === 0) return;
  const { error } = await ctx.supabase.storage.from(env.storageBucket).remove(owned);
  if (error) console.error('storage.remove', error.message);
}

/** Valida una ruta enviada por el cliente: debe estar en la carpeta del negocio. */
export function isValidMediaPath(ctx: BusinessContext, path: string | null, kind: MediaKind): boolean {
  return path === null || isPathOwnedBy(path, ctx.business.id, kind);
}
