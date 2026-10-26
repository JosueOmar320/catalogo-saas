'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { msg } from '@/i18n/translate';
import { ACTIVE_BUSINESS_COOKIE, getUser } from '@/lib/auth/session';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/utils/result';
import { isDemoEnabled } from './config';
import { createDemoAccount, DemoError, purgeDemo, purgeExpiredDemos } from './server';

const MESSAGES: Record<DemoError['code'], string> = {
  unavailable: msg('La cuenta de prueba no está disponible por ahora.'),
  full: msg('Hay muchas personas probando el panel. Intenta de nuevo en un rato.'),
  failed: msg('No se pudo preparar la cuenta de prueba. Intenta de nuevo.'),
};

/**
 * «Probar el panel»: crea un negocio de prueba propio (el café de ejemplo),
 * abre la sesión y lleva al panel. Sin registro; se borra solo en 24 horas.
 */
export async function startDemo(): Promise<ActionResult> {
  if (!isDemoEnabled()) return fail(MESSAGES.unavailable);
  // Por IP (3 por hora) y en total (60 por hora): cada demo crea una cuenta y copia fotos.
  const ip = await clientIp();
  const [byIp, overall] = await Promise.all([consumeRateLimit(`demo:ip:${ip}`, 3, 3600), consumeRateLimit('demo:all', 60, 3600)]);
  if (!byIp) return fail(msg('Ya creaste varias cuentas de prueba. Usa la que tienes abierta o intenta en una hora.'));
  if (!overall) return fail(MESSAGES.full);

  // De paso, las vencidas (además del cron diario).
  await purgeExpiredDemos(5);

  let account: Awaited<ReturnType<typeof createDemoAccount>>;
  try {
    account = await createDemoAccount();
  } catch (error) {
    return fail(MESSAGES[error instanceof DemoError ? error.code : 'failed']);
  }
  const supabase = await createClient();
  // Si había otra sesión abierta (otra demo o una cuenta real), se cierra antes.
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) return fail(MESSAGES.failed);
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, account.businessId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
  redirect('/dashboard?bienvenida=demo');
}

/** «Salir y borrar»: la cuenta de prueba se borra ya (sin esperar a que venza) y se vuelve al inicio. */
export async function endDemo(): Promise<void> {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = user ? await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle() : { data: null };
  if (profile?.demo) {
    const { data: membership } = await supabase.from('business_members').select('business_id').eq('user_id', profile.id).limit(1).maybeSingle();
    await supabase.auth.signOut();
    if (membership) await purgeDemo(createAdminClient(), membership.business_id).catch((error) => console.error('[demo] no se pudo borrar al salir', { code: (error as { code?: string }).code }));
  }
  redirect('/');
}
