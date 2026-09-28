'use server';

import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { parseInput } from '@/lib/utils/validation';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from './schema';

/** Sólo se permiten redirecciones internas (evita open redirects). */
function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export async function signIn(input: SignInValues, next?: string): Promise<ActionResult> {
  const parsed = parseInput(signInSchema, input);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === 'email_not_confirmed') return fail('Confirma tu email antes de entrar (revisa tu bandeja).');
    return fail('Email o contraseña incorrectos.');
  }
  redirect(safeNext(next));
}

export async function signUp(input: SignUpValues): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = parseInput(signUpSchema, input);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.siteUrl}/auth/confirm?next=/onboarding`,
    },
  });
  if (error) {
    if (error.code === 'user_already_exists') return fail('Ya existe una cuenta con ese email.');
    if (error.code === 'weak_password') return fail('La contraseña es muy débil.');
    return fail('No se pudo crear la cuenta. Intenta de nuevo.');
  }
  if (data.session) redirect('/onboarding');
  return ok({ needsConfirmation: true });
}

export async function requestPasswordReset(input: ForgotPasswordValues): Promise<ActionResult> {
  const parsed = parseInput(forgotPasswordSchema, input);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/reset-password`,
  });
  // Misma respuesta exista o no la cuenta (no revelar emails registrados).
  return ok(undefined, 'Si el email está registrado, te enviamos un enlace para restablecer la contraseña.');
}

export async function updatePassword(input: ResetPasswordValues): Promise<ActionResult> {
  const parsed = parseInput(resetPasswordSchema, input);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail('No se pudo actualizar la contraseña. Solicita un nuevo enlace.');
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
