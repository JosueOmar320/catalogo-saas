'use server';

import { getLocale } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { sendEmail } from '@/lib/email/resend';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { sampleCatalogReviewEmail } from './sample';

/** El administrador se envía a sí mismo un aviso de ejemplo (para probar Resend y el dominio). */
export async function sendTestReviewEmail(): Promise<ActionResult> {
  const { profile } = await requirePlatformAdmin();
  if (!profile.email) return fail(msg('Tu usuario no tiene email de contacto. Agrégalo en Usuarios.'));
  const email = sampleCatalogReviewEmail(await getLocale(), profile.full_name, profile.id);
  const result = await sendEmail({ to: profile.email, ...email });
  if (!result.ok) return fail(result.error === 'not_configured' ? msg('Falta configurar RESEND_API_KEY y EMAIL_FROM.') : msg('Resend rechazó el envío. Revisa la clave y que el dominio del remitente esté verificado.'));
  return ok(undefined, msg('Correo de prueba enviado'));
}
