'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getProfile, getUser, isPlatformAdmin } from '@/lib/auth/session';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import { accountSchema, changePasswordSchema, signInSchema, type AccountValues, type ChangePasswordValues, type SignInValues } from './schema';

const INVALID = 'Usuario o contraseña incorrectos.';

/** Sólo se permiten redirecciones internas (evita open redirects). */
function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

/**
 * Login con usuario + contraseña. El servidor resuelve el usuario a su
 * identificador de Supabase Auth con la service role (no hay ninguna API
 * pública que revele emails) e inicia sesión con la sesión normal (RLS).
 */
export async function signIn(input: SignInValues, next?: string): Promise<ActionResult> {
  const parsed = parseInput(signInSchema, input);
  if (!parsed.success) return parsed.result;
  const { username, password } = parsed.data;

  let loginEmail: string | null = null;
  if (username.includes('@')) {
    loginEmail = username; // cuentas creadas antes de la v4
  } else {
    if (!isServiceRoleConfigured()) return fail('El acceso con usuario requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.');
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
  const { data: profile } = await supabase.from('profiles').select('status, platform_role').eq('id', data.user.id).single();
  if (!profile || profile.status !== 'active') {
    await supabase.auth.signOut();
    return fail('Tu acceso está desactivado. Contacta al administrador.');
  }
  if (isServiceRoleConfigured()) {
    await createAdminClient().from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id);
  }
  redirect(safeNext(next) ?? (profile.platform_role === 'admin' ? '/admin' : '/dashboard'));
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
  if (!user?.email) return fail('Inicia sesión de nuevo.');
  const supabase = await createClient();
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (wrong) return fail('La contraseña actual no es correcta.', { currentPassword: ['La contraseña actual no es correcta'] });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.code === 'same_password' ? 'La nueva contraseña debe ser distinta.' : 'No se pudo cambiar la contraseña.');
  return ok(undefined, 'Contraseña actualizada');
}

export async function updateAccount(input: AccountValues): Promise<ActionResult> {
  const parsed = parseInput(accountSchema, input);
  if (!parsed.success) return parsed.result;
  const profile = await getProfile();
  if (!profile) return fail('Inicia sesión de nuevo.');
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ full_name: parsed.data.fullName }).eq('id', profile.id);
  if (error) return fail('No se pudo guardar.');
  revalidatePath('/cuenta');
  return ok(undefined, 'Datos guardados');
}

/** Destino inicial según el rol (para la página raíz del panel). */
export async function homeFor(): Promise<string> {
  return isPlatformAdmin(await getProfile()) ? '/admin' : '/dashboard';
}
