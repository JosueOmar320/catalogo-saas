'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { setLocaleCookie } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { safeNextPath } from '@/lib/auth/redirect';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { getProfile, getUser } from '@/lib/auth/session';
import { internalAuthSuffix } from '@/lib/auth/username';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import { accountSchema, changePasswordSchema, signInSchema, type AccountValues, type ChangePasswordValues, type SignInValues } from './schema';

const INVALID = msg('Usuario o contraseña incorrectos.');

/**
 * Login con usuario + contraseña. El servidor resuelve el usuario a su
 * identificador de Supabase Auth con la service role (no hay ninguna API
 * pública que revele emails) e inicia sesión con la sesión normal (RLS).
 */
export async function signIn(input: SignInValues, next?: string): Promise<ActionResult> {
  const parsed = parseInput(signInSchema, input);
  if (!parsed.success) return parsed.result;
  const { username, password } = parsed.data;

  // Fuerza bruta: por cuenta (10 intentos / 15 min) y por IP (30 / 15 min), compartido entre instancias.
  // La clave por cuenta es el usuario: "ana" y "ana@usuarios.invalid" (su correo interno) son la misma cuenta.
  const ip = await clientIp();
  const accountKey = username.toLowerCase().replace(internalAuthSuffix(), '');
  const [byAccount, byIp] = await Promise.all([consumeRateLimit(`login:u:${accountKey}`, 10, 900), consumeRateLimit(`login:ip:${ip}`, 30, 900)]);
  if (!byAccount || !byIp) return fail(msg('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'));

  let loginEmail: string | null = null;
  if (username.includes('@')) {
    loginEmail = username; // cuentas creadas antes de la v4
  } else {
    if (!isServiceRoleConfigured()) return fail(msg('El acceso con usuario requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.'));
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
    if (!profile) return fail(INVALID);
    const { data } = await admin.auth.admin.getUserById(profile.id);
    loginEmail = data.user?.email ?? null;
  }
  if (!loginEmail) return fail(INVALID);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
  if (error || !data.user) return fail(INVALID);

  // El estado se revisa DESPUÉS de validar la contraseña (no revela qué cuentas existen).
  const { data: profile } = await supabase.from('profiles').select('status, platform_role, locale').eq('id', data.user.id).single();
  if (!profile || profile.status !== 'active') {
    await supabase.auth.signOut();
    return fail(msg('Tu acceso está desactivado. Contacta al administrador.'));
  }
  if (isServiceRoleConfigured()) {
    await createAdminClient().from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id);
  }
  // El idioma elegido en otro dispositivo se aplica también en este navegador.
  if (isLocale(profile.locale)) await setLocaleCookie(profile.locale);
  redirect(safeNextPath(next) ?? (profile.platform_role === 'admin' ? '/admin' : '/dashboard'));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/** Cambio de contraseña del propio usuario (verifica la actual). */
export async function changePassword(input: ChangePasswordValues): Promise<ActionResult> {
  const parsed = parseInput(changePasswordSchema, input);
  if (!parsed.success) return parsed.result;
  const user = await getUser();
  if (!user?.email) return fail(msg('Inicia sesión de nuevo.'));
  if (!(await consumeRateLimit(`password:${user.id}`, 5, 900))) return fail(msg('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'));
  const supabase = await createClient();
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (wrong) return fail(msg('La contraseña actual no es correcta.'), { currentPassword: [msg('La contraseña actual no es correcta')] });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.code === 'same_password' ? msg('La nueva contraseña debe ser distinta.') : msg('No se pudo cambiar la contraseña.'));
  return ok(undefined, msg('Contraseña actualizada'));
}

export async function updateAccount(input: AccountValues): Promise<ActionResult> {
  const parsed = parseInput(accountSchema, input);
  if (!parsed.success) return parsed.result;
  const profile = await getProfile();
  if (!profile) return fail(msg('Inicia sesión de nuevo.'));
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ full_name: parsed.data.fullName }).eq('id', profile.id);
  if (error) return fail(msg('No se pudo guardar.'));
  revalidatePath('/cuenta');
  return ok(undefined, msg('Datos guardados'));
}

/** Activa o apaga el aviso semanal de pendientes del catálogo (sólo el propio perfil). */
export async function updateNotifications(input: { catalogReview: boolean }): Promise<ActionResult> {
  if (typeof input?.catalogReview !== 'boolean') return fail(msg('Revisa los datos.'));
  const profile = await getProfile();
  if (!profile) return fail(msg('Inicia sesión de nuevo.'));
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ notify_catalog_review: input.catalogReview }).eq('id', profile.id);
  if (error) return fail(msg('No se pudo guardar.'));
  revalidatePath('/cuenta');
  return ok(undefined, input.catalogReview ? msg('Aviso semanal activado') : msg('Aviso semanal desactivado'));
}

