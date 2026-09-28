'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { contactSchema, socialLinksSchema } from '@/lib/business/profile';
import { ACTIVE_BUSINESS_COOKIE, getBusinessContext, requireBusinessContext, requireUser, type BusinessContext } from '@/lib/auth/session';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { applyPreset, getPreset } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { pageToRow } from '@/lib/site/pages';
import { buildStarterSite } from '@/lib/site/starter';
import { createClient } from '@/lib/supabase/server';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import type { Json, TablesUpdate } from '@/types/database';
import { isValidMediaPath, removeStorageObjects } from '@/features/media/server';
import { businessProfileSchema, businessSlugSchema, onboardingSchema, type BusinessProfileValues, type OnboardingValues } from './schema';

const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 365 };

export async function checkSlugAvailability(slug: string): Promise<ActionResult<{ available: boolean }>> {
  await requireUser();
  const parsed = businessSlugSchema.safeParse(slug);
  if (!parsed.success) return ok({ available: false });
  const ctx = await getBusinessContext();
  if (ctx?.business.slug === parsed.data) return ok({ available: true });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_business_slug_available', { p_slug: parsed.data });
  if (error) return fail('No se pudo verificar la dirección.');
  return ok({ available: Boolean(data) });
}

/** Onboarding: crea negocio + catálogo con el estilo elegido (RPC atómica). */
export async function createBusiness(input: OnboardingValues): Promise<ActionResult> {
  await requireUser();
  const parsed = parseInput(onboardingSchema, input);
  if (!parsed.success) return parsed.result;
  const values = parsed.data;

  const theme = applyPreset(DEFAULT_THEME, getPreset(values.presetId));
  const settings = catalogSettingsSchema.parse({
    contactActions: { whatsapp: { enabled: true }, phone: { enabled: !values.whatsapp } },
  });

  const supabase = await createClient();
  const { data: businessId, error } = await supabase.rpc('create_business', {
    p_name: values.name,
    p_slug: values.slug,
    p_contact: contactSchema.parse({ whatsapp: values.whatsapp }) as Json,
    p_catalog_theme: theme as Json,
    p_catalog_settings: settings as Json,
  });
  if (error) {
    return fail(dbErrorMessage(error, 'No se pudo crear el negocio.'), error.message.includes('slug') ? { slug: ['Esa dirección ya está en uso'] } : undefined);
  }

  // Sitio inicial (Inicio, Productos/Servicios, Nosotros, Contacto) en una transacción.
  const { data: catalog } = await supabase.from('catalogs').select('id').eq('business_id', businessId).eq('is_default', true).single();
  if (catalog) {
    const starter = buildStarterSite(values.offering);
    await supabase.rpc('save_site', {
      p_catalog_id: catalog.id,
      p_navigation: starter.navigation as Json,
      p_pages: starter.pages.map(pageToRow) as unknown as Json,
      p_deleted_page_ids: [],
    });
  }

  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, COOKIE_OPTIONS);
  redirect('/dashboard?welcome=1');
}

async function updateBusiness(ctx: BusinessContext, patch: TablesUpdate<'businesses'>, message: string, previousSlug?: string): Promise<ActionResult> {
  if (ctx.role === 'editor') return fail('Sólo el dueño o un administrador puede cambiar esto.');
  const { error } = await ctx.supabase.from('businesses').update(patch).eq('id', ctx.business.id);
  if (error) return fail(dbErrorMessage(error));
  invalidatePublicCatalog(ctx.business.slug);
  if (previousSlug && patch.slug && patch.slug !== previousSlug) invalidatePublicCatalog(patch.slug);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined, message);
}

export async function updateBusinessProfile(input: BusinessProfileValues): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(businessProfileSchema, input);
  if (!parsed.success) return parsed.result;
  const { name, slug, slogan, description } = parsed.data;
  if (slug !== ctx.business.slug) {
    const { data: available } = await ctx.supabase.rpc('is_business_slug_available', { p_slug: slug });
    if (!available) return fail('Esa dirección ya está en uso.', { slug: ['Esa dirección ya está en uso'] });
  }
  return updateBusiness(ctx, { name, slug, slogan: slogan || null, description: description || null }, 'Datos del negocio guardados', ctx.business.slug);
}

export async function updateContact(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(contactSchema, input);
  if (!parsed.success) return parsed.result;
  return updateBusiness(ctx, { contact: parsed.data as Json }, 'Contacto guardado');
}

export async function updateSocialLinks(input: z.input<typeof socialLinksSchema>): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = parseInput(socialLinksSchema, input);
  if (!parsed.success) return parsed.result;
  return updateBusiness(ctx, { social_links: parsed.data as Json }, 'Redes sociales guardadas');
}

export async function setBusinessLogo(path: string | null): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (path !== null && typeof path !== 'string') return fail('Imagen inválida.');
  if (!isValidMediaPath(ctx, path, 'logo')) return fail('Imagen inválida.');
  const previous = ctx.business.logo_path;
  const result = await updateBusiness(ctx, { logo_path: path }, path ? 'Logo actualizado' : 'Logo eliminado');
  if (result.ok && previous && previous !== path) await removeStorageObjects(ctx, [previous]);
  return result;
}

/** Cambia el negocio activo. La membresía se verifica (RLS) antes de guardar la cookie. */
export async function switchBusiness(businessId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('businesses').select('id').eq('id', businessId).is('deleted_at', null).maybeSingle();
  if (!data) return fail('No tienes acceso a ese negocio.');
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, data.id, COOKIE_OPTIONS);
  revalidatePath('/dashboard', 'layout');
  return ok(undefined);
}
