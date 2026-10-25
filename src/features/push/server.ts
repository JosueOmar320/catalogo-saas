import 'server-only';
import webpush from 'web-push';
import { APP_EN } from '@/i18n/en';
import { isLocale } from '@/i18n/config';
import { createTranslator } from '@/i18n/translate';
import { isPushEndpoint, orderPushPayload, type PushPayload } from '@/lib/push/core';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/** Tras tantos fallos seguidos (no 404/410) el dispositivo se da de baja. */
const MAX_FAILURES = 5;

const keys = () => ({
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? '',
  privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? '',
  subject: process.env.VAPID_SUBJECT?.trim() || 'mailto:avisos@example.com',
});

/** Hay claves VAPID y service role: se pueden mandar avisos. */
export function isPushConfigured(): boolean {
  const { publicKey, privateKey } = keys();
  return Boolean(publicKey && privateKey && isServiceRoleConfigured());
}

type Target = { id: string; endpoint: string; p256dh: string; auth: string };

/** Manda un aviso a cada dispositivo y limpia los que ya no existen. */
async function deliver<T extends Target>(targets: T[], payloadFor: (target: T) => PushPayload) {
  const { publicKey, privateKey, subject } = keys();
  const admin = createAdminClient();
  await Promise.all(
    targets.filter((target) => isPushEndpoint(target.endpoint)).map(async (target) => {
      try {
        await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payloadFor(target)), {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: 60 * 60,
          urgency: 'high',
          timeout: 10_000,
        });
        await admin.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failures: 0 }).eq('id', target.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: el navegador dio de baja la suscripción.
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', target.id);
        else {
          console.error('[push] no se pudo mandar el aviso', { status: status ?? null });
          const { data } = await admin.from('push_subscriptions').select('failures').eq('id', target.id).maybeSingle();
          const failures = (data?.failures ?? 0) + 1;
          if (failures >= MAX_FAILURES) await admin.from('push_subscriptions').delete().eq('id', target.id);
          else await admin.from('push_subscriptions').update({ failures }).eq('id', target.id);
        }
      }
    }),
  );
}

/**
 * Aviso de pedido nuevo a los miembros del negocio (lo llama /api/orders
 * después de responder). Cada pedido se avisa una sola vez.
 */
export async function notifyNewOrder(slug: string, reference: string, priceLocale?: string): Promise<void> {
  if (!isPushConfigured()) return;
  try {
    const admin = createAdminClient();
    const { data: claimed, error } = await admin.rpc('claim_order_push', { p_business_slug: slug, p_reference: reference });
    const order = claimed?.[0];
    if (error || !order) return;
    const { data: targets } = await admin.rpc('push_targets', { p_business: order.business_id });
    if (!targets?.length) return;
    await deliver(targets, (target) => {
      const locale = isLocale(target.locale) ? target.locale : 'es';
      return orderPushPayload(createTranslator(locale, APP_EN), {
        reference: order.reference,
        customerName: order.customer_name,
        items: order.items,
        total: order.total,
        currency: order.currency,
        partial: order.partial,
        businessName: order.business_name,
      }, priceLocale ?? (locale === 'en' ? 'en-US' : 'es-MX'));
    });
  } catch (error) {
    console.error('[push] aviso de pedido', { message: String((error as Error)?.message ?? error).slice(0, 160) });
  }
}

/** "Probar aviso": sólo al dispositivo indicado, si es del usuario. */
export async function sendTestPush(userId: string, endpoint: string, payload: PushPayload): Promise<boolean> {
  if (!isPushConfigured()) return false;
  const { data } = await createAdminClient().from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId).eq('endpoint', endpoint).maybeSingle();
  if (!data) return false;
  await deliver([data], () => payload);
  return true;
}
