'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_BUSINESS_COOKIE, requirePlatformAdmin } from '@/lib/auth/session';
import { internalAuthEmail } from '@/lib/auth/username';
import { contactSchema } from '@/lib/business/profile';
import { invalidatePublicCatalog } from '@/lib/catalog/cache';
import { catalogSettingsSchema } from '@/lib/catalog/settings';
import { applyPreset, getPreset } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { pageToRow } from '@/lib/site/pages';
import { buildStarterSite } from '@/lib/site/starter';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import type { Json, MemberRole } from '@/types/database';
import {
  createBusinessSchema,
  createUserSchema,
  MEMBER_ROLES,
  resetPasswordSchema,
  updateBusinessSchema,
  updateCatalogSchema,
  updateUserSchema,
  type CreateBusinessValues,
  type CreateUserValues,
  type UpdateBusinessValues,
  type UpdateCatalogValues,
  type UpdateUserValues,
} from './schema';

/**
 * Acciones del panel de administración. Cada una:
 *  1) verifica en el servidor que la sesión es de un administrador activo,
 *  2) valida la entrada con Zod, y
 *  3) opera mediante RPCs que la base vuelve a autorizar (is_platform_admin)
 *     y audita. La service role sólo se usa para la Admin API de Auth.
 */

const BAN_FOREVER = '876000h';
const toLimit = (v: '' | number) => (v === '' ? null : v);

function refresh(...paths: string[]) {
  for (const path of ['/admin', ...paths]) revalidatePath(path, 'layout');
}

/* ------------------------------------------------------------ Usuarios */

export async function checkUsername(username: string): Promise<ActionResult<{ available: boolean }>> {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.from('profiles').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
  return ok({ available: !data });
}

export async function createUser(input: CreateUserValues): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requirePlatformAdmin();
  const parsed = parseInput(createUserSchema, input);
  if (!parsed.success) return parsed.result;
  if (!isServiceRoleConfigured()) return fail('Configura SUPABASE_SERVICE_ROLE_KEY en el servidor para crear usuarios.');
  const values = parsed.data;

  const { data: taken } = await supabase.from('profiles').select('id').eq('username', values.username).maybeSingle();
  if (taken) return fail('Ese usuario ya existe.', { username: ['Ese usuario ya existe'] });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    // Identificador interno no entregable: el acceso es con el usuario.
    email: internalAuthEmail(values.username),
    password: values.password,
    email_confirm: true,
    user_metadata: { full_name: values.fullName },
    app_metadata: { provisioned: true, username: values.username, contact_email: values.email || null, created_by: userId },
  });
  if (error || !data.user) {
    if (error?.code === 'weak_password') return fail('La contraseña es muy débil.', { password: ['Usa una contraseña más fuerte'] });
    if (error?.code === 'email_exists' || error?.code === 'user_already_exists') return fail('Ese usuario ya existe.', { username: ['Ese usuario ya existe'] });
    return fail('No se pudo crear el usuario.');
  }
  const id = data.user.id;

  // Rol, datos y límite (auditado con el administrador como autor).
  const { error: profileError } = await supabase.rpc('admin_update_profile', {
    p_user: id,
    p_full_name: values.fullName,
    p_email: values.email || null,
    p_role: values.role,
    p_status: 'active',
    p_max_businesses: toLimit(values.maxBusinesses),
  });
  if (profileError) return fail(dbErrorMessage(profileError, 'El usuario se creó, pero no se pudo completar su perfil.'));

  for (const assignment of values.assignments) {
    const { error: assignError } = await supabase.rpc('admin_set_business_member', { p_business: assignment.businessId, p_user: id, p_role: assignment.role });
    if (assignError) return fail(`El usuario se creó, pero: ${dbErrorMessage(assignError, 'no se pudo asignar un negocio.')}`);
  }
  await supabase.rpc('log_audit', { p_action: 'user.create', p_entity_type: 'user', p_entity_id: id, p_metadata: { username: values.username, role: values.role } as Json });
  refresh('/admin/usuarios');
  return ok({ id }, `Usuario @${values.username} creado`);
}

export async function updateUser(id: string, input: UpdateUserValues): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  const parsed = parseInput(updateUserSchema, input);
  if (!parsed.success) return parsed.result;
  const values = parsed.data;
  const { data: before } = await supabase.from('profiles').select('status').eq('id', id).single();
  if (!before) return fail('El usuario no existe.');

  const { error } = await supabase.rpc('admin_update_profile', {
    p_user: id,
    p_full_name: values.fullName,
    p_email: values.email || null,
    p_role: values.role,
    p_status: values.status,
    p_max_businesses: toLimit(values.maxBusinesses),
  });
  if (error) return fail(dbErrorMessage(error));

  // Además de RLS (efecto inmediato), se bloquea el inicio de sesión en Auth.
  if (before.status !== values.status && isServiceRoleConfigured()) {
    await createAdminClient().auth.admin.updateUserById(id, { ban_duration: values.status === 'disabled' ? BAN_FOREVER : 'none' });
  }
  refresh('/admin/usuarios');
  return ok(undefined, values.status === 'disabled' && before.status !== 'disabled' ? 'Usuario desactivado' : 'Usuario guardado');
}

export async function resetUserPassword(id: string, input: { password: string }): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  const parsed = parseInput(resetPasswordSchema, input);
  if (!parsed.success) return parsed.result;
  if (!isServiceRoleConfigured()) return fail('Configura SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', id).single();
  if (!profile) return fail('El usuario no existe.');
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password: parsed.data.password });
  if (error) return fail(error.code === 'weak_password' ? 'La contraseña es muy débil.' : 'No se pudo cambiar la contraseña.');
  await supabase.rpc('log_audit', { p_action: 'user.password_reset', p_entity_type: 'user', p_entity_id: id, p_metadata: { username: profile.username } as Json });
  return ok(undefined, `Contraseña de @${profile.username} actualizada`);
}

export async function setMembership(businessId: string, userId: string, role: MemberRole): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  if (!(MEMBER_ROLES as readonly string[]).includes(role)) return fail('Rol inválido.');
  const { error } = await supabase.rpc('admin_set_business_member', { p_business: businessId, p_user: userId, p_role: role });
  if (error) return fail(dbErrorMessage(error));
  refresh('/admin/usuarios', '/admin/negocios');
  return ok(undefined, 'Acceso asignado');
}

export async function removeMembership(businessId: string, userId: string): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc('admin_remove_business_member', { p_business: businessId, p_user: userId });
  if (error) return fail(dbErrorMessage(error));
  refresh('/admin/usuarios', '/admin/negocios');
  return ok(undefined, 'Acceso quitado');
}

/* ------------------------------------------------------------ Negocios */

export async function checkBusinessSlug(slug: string): Promise<ActionResult<{ available: boolean }>> {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.rpc('is_business_slug_available', { p_slug: slug });
  return ok({ available: Boolean(data) });
}

/** Negocio + catálogo + propietario + sitio inicial (el mismo que tenía el onboarding). */
export async function createBusiness(input: CreateBusinessValues): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requirePlatformAdmin();
  const parsed = parseInput(createBusinessSchema, input);
  if (!parsed.success) return parsed.result;
  const values = parsed.data;

  const theme = applyPreset(DEFAULT_THEME, getPreset(values.presetId));
  const settings = catalogSettingsSchema.parse({ contactActions: { whatsapp: { enabled: true }, phone: { enabled: !values.whatsapp } } });
  const { data: businessId, error } = await supabase.rpc('admin_create_business', {
    p_name: values.name,
    p_slug: values.slug,
    p_owner: values.ownerId || null,
    p_plan_id: values.planId,
    p_contact: contactSchema.parse({ whatsapp: values.whatsapp }) as Json,
    p_catalog_theme: theme as Json,
    p_catalog_settings: settings as Json,
  });
  if (error || !businessId) return fail(dbErrorMessage(error, 'No se pudo crear el negocio.'), error?.message.includes('slug') ? { slug: ['Esa dirección ya está en uso'] } : undefined);

  const { data: catalog } = await supabase.from('catalogs').select('id').eq('business_id', businessId).eq('is_default', true).single();
  if (catalog) {
    const starter = buildStarterSite(values.offering);
    await supabase.rpc('save_site', { p_catalog_id: catalog.id, p_navigation: starter.navigation as Json, p_pages: starter.pages.map(pageToRow) as unknown as Json, p_deleted_page_ids: [] });
  }
  refresh('/admin/negocios', '/admin/catalogos');
  return ok({ id: businessId }, `Negocio «${values.name}» creado`);
}

export async function updateBusiness(id: string, input: UpdateBusinessValues): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  const parsed = parseInput(updateBusinessSchema, input);
  if (!parsed.success) return parsed.result;
  const { data: before } = await supabase.from('businesses').select('slug').eq('id', id).single();
  const { error } = await supabase.rpc('admin_update_business', { p_business: id, p_name: parsed.data.name, p_slug: parsed.data.slug, p_plan_id: parsed.data.planId, p_status: parsed.data.status });
  if (error) return fail(dbErrorMessage(error), error.message.includes('slug') ? { slug: ['Esa dirección ya está en uso'] } : undefined);
  if (before) invalidatePublicCatalog(before.slug);
  invalidatePublicCatalog(parsed.data.slug);
  refresh('/admin/negocios');
  return ok(undefined, parsed.data.status === 'suspended' ? 'Negocio guardado (suspendido)' : 'Negocio guardado');
}

/** Abre el negocio en el editor (el admin opera con permisos de dueño; queda auditado). */
export async function openBusiness(id: string): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.from('businesses').select('id').eq('id', id).single();
  if (!data) redirect('/admin/negocios');
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/dashboard');
}

/* ------------------------------------------------------------ Catálogos */

export async function createCatalog(businessId: string, name: string): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  const clean = name.trim().slice(0, 120);
  if (!clean) return fail('Escribe un nombre.');
  const { error } = await supabase.rpc('admin_create_catalog', { p_business: businessId, p_name: clean });
  if (error) return fail(dbErrorMessage(error));
  refresh('/admin/catalogos', '/admin/negocios');
  return ok(undefined, 'Catálogo creado');
}

export async function updateCatalog(id: string, input: UpdateCatalogValues): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  const parsed = parseInput(updateCatalogSchema, input);
  if (!parsed.success) return parsed.result;
  const { data: catalog } = await supabase.from('catalogs').select('business_id').eq('id', id).single();
  const { error } = await supabase.rpc('admin_update_catalog', { p_catalog: id, p_name: parsed.data.name, p_is_active: parsed.data.isActive, p_make_default: parsed.data.makeDefault });
  if (error) return fail(dbErrorMessage(error));
  if (catalog) {
    const { data: business } = await supabase.from('businesses').select('slug').eq('id', catalog.business_id).single();
    if (business) invalidatePublicCatalog(business.slug);
  }
  refresh('/admin/catalogos', '/admin/negocios');
  return ok(undefined, parsed.data.isActive ? 'Catálogo guardado' : 'Catálogo desactivado');
}

/* ------------------------------------------------------------ Medios */

export async function deleteMedia(id: string): Promise<ActionResult> {
  const { supabase } = await requirePlatformAdmin();
  const { data: asset } = await supabase.from('media_assets').select('path, thumb_path').eq('id', id).single();
  if (!asset) return fail('La imagen no existe.');
  const { error } = await supabase.from('media_assets').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return fail(dbErrorMessage(error));
  refresh('/admin/medios');
  return ok(undefined, 'Imagen quitada de la biblioteca');
}
