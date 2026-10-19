import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { supabaseStorage } from '@/lib/storage/provider';
import { isExternalMediaUrl, isPathOwnedBy } from '@/lib/utils/storage';

/**
 * Valida una ruta enviada por el cliente para un campo que exige un archivo
 * propio (logo, portada, categoría…): cualquier carpeta del negocio sirve.
 */
export function isValidMediaPath(ctx: BusinessContext, path: string | null): boolean {
  return path === null || isPathOwnedBy(path, ctx.business.id);
}

/**
 * Referencias de imagen dentro de contenido (secciones, tema, PDF): archivos
 * del negocio o URLs externas REGISTRADAS en su biblioteca. Devuelve las
 * referencias inválidas (vacío = todo bien).
 */
export async function invalidMediaRefs(ctx: BusinessContext, refs: string[]): Promise<string[]> {
  const unique = [...new Set(refs)];
  const external = unique.filter(isExternalMediaUrl);
  const invalid: string[] = unique.filter((ref) => !isExternalMediaUrl(ref) && !isPathOwnedBy(ref, ctx.business.id));
  if (external.length) {
    const { data } = await ctx.supabase
      .from('media_assets')
      .select('path')
      .eq('business_id', ctx.business.id)
      .eq('storage_provider', 'external')
      .is('deleted_at', null)
      .in('path', external.slice(0, 200));
    const known = new Set((data ?? []).map((m) => m.path));
    invalid.push(...external.filter((url) => !known.has(url)));
  }
  return invalid;
}

/**
 * Archivos que un formulario dejó de usar (logo reemplazado, foto quitada…).
 * La biblioteca es la dueña de los archivos: sólo se borran los que NO están
 * en ella y ya no se usan en ningún lado (subidas abandonadas).
 */
export async function releaseStorageObjects(ctx: BusinessContext, paths: (string | null | undefined)[]) {
  const owned = [...new Set(paths.filter((p): p is string => Boolean(p) && isPathOwnedBy(p!, ctx.business.id)))];
  if (owned.length === 0) return;
  // Sólo las rutas candidatas (antes se leía toda la biblioteca: con más de 1000 imágenes la
  // respuesta se cortaba y un archivo de la biblioteca podía parecer "sin dueño").
  // Falla cerrado: si alguna consulta falla, no se borra nada (un error transitorio no puede
  // hacer que un archivo en uso parezca libre). Como mucho queda un archivo huérfano.
  const [byPath, byThumb] = await Promise.all([
    ctx.supabase.from('media_assets').select('path').eq('business_id', ctx.business.id).is('deleted_at', null).in('path', owned),
    ctx.supabase.from('media_assets').select('thumb_path').eq('business_id', ctx.business.id).is('deleted_at', null).in('thumb_path', owned),
  ]);
  if (byPath.error || byThumb.error) return;
  const kept = new Set<string>([...byPath.data.map((m) => m.path), ...byThumb.data.flatMap((m) => (m.thumb_path ? [m.thumb_path] : []))]);
  const candidates = owned.filter((p) => !kept.has(p));
  const removable: string[] = [];
  for (const path of candidates) {
    const { data, error } = await ctx.supabase.rpc('media_references', { p_business: ctx.business.id, p_path: path });
    if (error) return;
    if (!data || data.length === 0) removable.push(path);
  }
  if (removable.length === 0) return;
  await supabaseStorage(ctx.supabase).remove(removable);
}
