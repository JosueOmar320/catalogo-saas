'use server';

import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { attributeDefsSchema, type AttributeDef } from '@/lib/catalog/attributes';
import { afterCatalogChange } from '@/lib/catalog/cache';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import type { Json } from '@/types/database';
import { msg } from '@/i18n/translate';

/**
 * Guarda las definiciones de atributos del catálogo. Borrar un atributo no
 * toca los ítems: sus valores quedan guardados pero dejan de mostrarse
 * (parseAttributeValues sólo lee atributos definidos).
 */
export async function saveAttributeDefs(input: AttributeDef[]): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede cambiar esto.'));
  const parsed = attributeDefsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? msg('Revisa los atributos.'));
  // Las opciones sólo tienen sentido en "Opciones" y "Lista" (sugerencias).
  const defs = parsed.data.map((d) => ({ ...d, options: d.type === 'select' || d.type === 'list' ? [...new Set(d.options)] : [] }));
  if (defs.some((d) => d.type === 'select' && d.options.length === 0)) return fail(msg('Agrega al menos una opción a los atributos de tipo "Opciones".'));
  const { error } = await ctx.supabase.from('catalogs').update({ attribute_defs: defs as Json }).eq('id', ctx.catalog.id);
  if (error) return fail(dbErrorMessage(error));
  afterCatalogChange(ctx);
  return ok(undefined, msg('Atributos guardados'));
}
