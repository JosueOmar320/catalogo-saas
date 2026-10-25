'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';
import { requireBusinessContext } from '@/lib/auth/session';
import { deviceLabel, isPushEndpoint } from '@/lib/push/core';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/utils/result';
import { sendTestPush } from './server';

const subscriptionSchema = z.object({
  endpoint: z.string().refine(isPushEndpoint),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** Activa los avisos en este dispositivo (la suscripción que dio el navegador). */
export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return fail(msg('Este navegador no se pudo registrar para los avisos.'));
  const device = deviceLabel((await headers()).get('user-agent') ?? '');
  const { error } = await ctx.supabase.rpc('register_push_subscription', { p_endpoint: parsed.data.endpoint, p_p256dh: parsed.data.keys.p256dh, p_auth: parsed.data.keys.auth, p_device: device });
  if (error?.message.includes('push_limit')) return fail(msg('Ya tienes avisos en 10 dispositivos. Desactívalos en alguno para agregar éste.'));
  if (error) return fail(dbErrorMessage(error, msg('No se pudieron activar los avisos.')));
  return ok(undefined, msg('Avisos activados en este dispositivo'));
}

/** Desactiva los avisos de este dispositivo. */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!isPushEndpoint(endpoint)) return ok(undefined, msg('Avisos desactivados en este dispositivo'));
  const { error } = await ctx.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', ctx.userId);
  if (error) return fail(dbErrorMessage(error, msg('No se pudieron desactivar los avisos.')));
  return ok(undefined, msg('Avisos desactivados en este dispositivo'));
}

/** "Probar aviso": manda uno de ejemplo a este dispositivo. */
export async function sendTestNotification(endpoint: string): Promise<ActionResult> {
  const ctx = await requireBusinessContext();
  if (!isPushEndpoint(endpoint)) return fail(msg('Activa los avisos en este dispositivo primero.'));
  const t = await getT();
  const sent = await sendTestPush(ctx.userId, endpoint, {
    title: t('Así se verá un pedido nuevo'),
    body: t('Pedido de prueba de {business}. Toca para abrir tus pedidos.', { business: ctx.business.name }),
    url: '/dashboard/pedidos',
    tag: 'test',
  });
  return sent ? ok(undefined, msg('Aviso de prueba enviado')) : fail(msg('Activa los avisos en este dispositivo primero.'));
}
