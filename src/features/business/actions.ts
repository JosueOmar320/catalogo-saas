'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveMapsLocation } from '@/lib/business/maps-server';
import { contactSchema, socialLinksSchema } from '@/lib/business/profile';
import { ACTIVE_BUSINESS_COOKIE, canManageCatalog, getBusinessContext, requireBusinessContext, requireUser, type BusinessContext } from '@/lib/auth/session';
import { afterCatalogChange, invalidatePublicCatalog } from '@/lib/catalog/cache';
import { createClient } from '@/lib/supabase/server';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import { msg } from '@/i18n/translate';
import type { Json, TablesUpdate } from '@/types/database';
import { isValidMediaPath, releaseStorageObjects } from '@/features/media/server';
import { businessProfileSchema, businessSlugSchema, type BusinessProfileValues } from './schema';

const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 365 };

export async function checkSlugAvailability(slug: string): Promise<ActionResult<{ available: boolean }>> {
  await requireUser();
  const parsed = businessSlugSchema.safeParse(slug);
  if (!parsed.success) return ok({ available: false });
  const ctx = await getBusinessContext();
  if (ctx?.business.slug === parsed.data) return ok({ available: true });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_business_slug_available', { p_slug: parsed.data });
  if (error) return fail(msg('No se pudo verificar la dirección.'));
  return ok({ available: Boolean(data) });
}

async function updateBusiness(ctx: BusinessContext, patch: TablesUpdate<'businesses'>, message: string, previousSlug?: string): Promise<ActionResult> {
  if (!canManageCatalog(ctx)) return fail(msg('Sólo el dueño o un administrador puede cambiar esto.'));
  const { error } = await ctx.supabase.from('businesses').update(patch).eq('id', ctx.business.id);
  if (error) return fail(dbErrorMessage(error));
  afterCatalogChange(ctx);
  if (previousSlug && patch.slug && patch.slug !== previousSlug) invalidatePublicCatalog(patch.slug);
  return ok(undefined, message);
}

export async function updateBusinessProfile(input: BusinessProfileValues): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(businessProfileSchema, input);
  if (!parsed.success) return parsed.result;
  const { name, slug, slogan, description } = parsed.data;
  if (slug !== ctx.business.slug) {
    const { data: available } = await ctx.supabase.rpc('is_business_slug_available', { p_slug: slug });
    if (!available) return fail(msg('Esa dirección ya está en uso.'), { slug: [msg('Esa dirección ya está en uso')] });
  }
  return updateBusiness(ctx, { name, slug, slogan: slogan || null, description: description || null }, msg('Datos del negocio guardados'), ctx.business.slug);
}

export async function updateContact(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(contactSchema, input);
  if (!parsed.success) return parsed.result;
  // La ubicación del mapa la calcula el servidor (nunca se confía en la del cliente).
  const mapsLocation = (await resolveMapsLocation(parsed.data.mapsUrl)) ?? '';
  return updateBusiness(ctx, { contact: { ...parsed.data, mapsLocation } as Json }, msg('Contacto guardado'));
}

export async function updateSocialLinks(input: z.input<typeof socialLinksSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(socialLinksSchema, input);
  if (!parsed.success) return parsed.result;
  return updateBusiness(ctx, { social_links: parsed.data as Json }, msg('Redes sociales guardadas'));
}

export async function setBusinessLogo(path: string | null): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (path !== null && typeof path !== 'string') return fail(msg('Imagen inválida.'));
  if (!isValidMediaPath(ctx, path)) return fail(msg('Imagen inválida.'));
  const previous = ctx.business.logo_path;
  const result = await updateBusiness(ctx, { logo_path: path }, path ? msg('Logo actualizado') : msg('Logo eliminado'));
  if (result.ok && previous && previous !== path) await releaseStorageObjects(ctx, [previous]);
  return result;
}

/** Cambia el negocio activo. La membresía se verifica (RLS) antes de guardar la cookie. */
export async function switchBusiness(businessId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('businesses').select('id').eq('id', businessId).is('deleted_at', null).maybeSingle();
  if (!data) return fail(msg('No tienes acceso a ese negocio.'));
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, data.id, COOKIE_OPTIONS);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined);
}
