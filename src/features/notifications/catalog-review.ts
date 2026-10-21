import 'server-only';
import { isLocale } from '@/i18n/config';
import { countReview, itemHasPrice } from '@/features/items/review';
import { buildCatalogReviewEmail, reviewTotal, type CatalogReviewCounts } from '@/lib/email/catalog-review';
import { unsubscribeToken } from '@/lib/email/links';
import { isEmailConfigured, sendEmail } from '@/lib/email/resend';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/paginate';

/**
 * Aviso semanal de "Revisa tu catálogo" (lo dispara /api/cron/catalog-review).
 *
 * Destinatarios: propietarios y administradores de negocios activos, con
 * cuenta activa, correo de contacto y el aviso activado. Sólo se envía si el
 * negocio tiene pendientes accionables (sin foto, sin precio, sin categoría,
 * reseñas por aprobar) y
 * no se avisó a esa persona sobre ese negocio en los últimos 6 días.
 *
 * Sin RESEND_API_KEY/EMAIL_FROM (o con dryRun) no envía nada: devuelve a
 * quién se le habría enviado, para revisar antes de activarlo.
 */
const RECENT_DAYS = 6;
/** Por ejecución (el límite gratuito de Resend es 2 por segundo y la función tiene 60 s). */
const MAX_SENDS = 80;
const SEND_GAP_MS = 600;

export const linkSecret = () => process.env.CRON_SECRET ?? '';
const token = (userId: string) => encodeURIComponent(unsubscribeToken(userId, linkSecret()));
/** Enlace visible del correo: página que pide confirmar (los escáneres de enlaces no dan de baja a nadie). */
export const unsubscribeUrl = (userId: string) => `${env.siteUrl}/baja?token=${token(userId)}`;
/** Cabecera List-Unsubscribe: el cliente de correo hace POST aquí (baja en un clic, RFC 8058). */
export const oneClickUnsubscribeUrl = (userId: string) => `${env.siteUrl}/api/email/unsubscribe?token=${token(userId)}`;

export type CatalogReviewRecipient = {
  userId: string;
  email: string;
  name: string | null;
  locale: 'es' | 'en';
  businessId: string;
  businessName: string;
  counts: CatalogReviewCounts;
};

export type CatalogReviewSummary = {
  dryRun: boolean;
  /** Personas × negocios que podrían recibirlo (con correo y el aviso activado). */
  candidates: number;
  /** De ésos, con pendientes y sin aviso reciente. */
  due: number;
  sent: number;
  failed: number;
  /** Quedaron para la próxima ejecución por el límite por corrida. */
  deferred: number;
};

/** Personas × negocios a los que corresponde avisar hoy. */
export async function findCatalogReviewRecipients(now = new Date()): Promise<{ candidates: number; due: CatalogReviewRecipient[] }> {
  const db = createAdminClient();

  const profiles = await fetchAllRows((from, to) =>
    db.from('profiles').select('id, email, full_name, locale').eq('status', 'active').eq('notify_catalog_review', true).not('email', 'is', null).order('id').range(from, to),
  );
  if (profiles.length === 0) return { candidates: 0, due: [] };
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const members = (
    await fetchAllRows((from, to) => db.from('business_members').select('business_id, user_id, role').in('role', ['owner', 'admin']).order('business_id').order('user_id').range(from, to))
  ).filter((m) => profileById.has(m.user_id));

  const businessIds = [...new Set(members.map((m) => m.business_id))];
  if (businessIds.length === 0) return { candidates: 0, due: [] };

  // Lotes de ids para no armar URLs gigantes.
  const chunks = <T,>(list: T[], size = 200) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
  const businesses = (
    await Promise.all(chunks(businessIds).map(async (ids) => (await db.from('businesses').select('id, name').in('id', ids).eq('status', 'active').is('deleted_at', null)).data ?? []))
  ).flat();
  const businessName = new Map(businesses.map((b) => [b.id, b.name]));
  const activeIds = businesses.map((b) => b.id);
  if (activeIds.length === 0) return { candidates: 0, due: [] };

  const catalogs = (
    await Promise.all(chunks(activeIds).map(async (ids) => (await db.from('catalogs').select('id, business_id').in('business_id', ids).eq('is_default', true).is('deleted_at', null)).data ?? []))
  ).flat();
  const catalogIds = catalogs.map((c) => c.id);
  const businessOfCatalog = new Map(catalogs.map((c) => [c.id, c.business_id]));

  const [categories, items, images, recent, reviews] = await Promise.all([
    Promise.all(chunks(catalogIds).map(async (ids) => (await db.from('categories').select('catalog_id').in('catalog_id', ids).is('deleted_at', null)).data ?? [])).then((r) => r.flat()),
    Promise.all(
      chunks(catalogIds).map((ids) =>
        fetchAllRows((from, to) =>
          db.from('catalog_items').select('id, catalog_id, type, price, attributes, category_id, is_available, is_visible').in('catalog_id', ids).is('deleted_at', null).order('id').range(from, to),
        ),
      ),
    ).then((r) => r.flat()),
    Promise.all(chunks(activeIds).map((ids) => fetchAllRows((from, to) => db.from('catalog_item_images').select('item_id').in('business_id', ids).order('id').range(from, to)))).then((r) => r.flat()),
    fetchAllRows((from, to) =>
      db
        .from('notification_log')
        .select('user_id, business_id')
        .eq('kind', 'catalog_review')
        .gte('sent_at', new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString())
        .order('id')
        .range(from, to),
    ),
    // Reseñas por aprobar (sin la migración de reseñas, la consulta falla y no cuentan).
    Promise.all(chunks(activeIds).map(async (ids) => (await db.from('reviews').select('business_id').in('business_id', ids).eq('status', 'pending').limit(5000)).data ?? [])).then((r) => r.flat()),
  ]);
  const pendingReviews = new Map<string, number>();
  for (const review of reviews) pendingReviews.set(review.business_id, (pendingReviews.get(review.business_id) ?? 0) + 1);

  const withImage = new Set(images.map((i) => i.item_id));
  const catalogsWithCategories = new Set(categories.map((c) => c.catalog_id));
  const itemsByBusiness = new Map<string, typeof items>();
  for (const item of items) {
    const businessId = businessOfCatalog.get(item.catalog_id);
    if (!businessId) continue;
    const list = itemsByBusiness.get(businessId) ?? [];
    list.push(item);
    itemsByBusiness.set(businessId, list);
  }
  const countsByBusiness = new Map<string, CatalogReviewCounts>();
  for (const catalog of catalogs) {
    const review = countReview(
      (itemsByBusiness.get(catalog.business_id) ?? []).map((i) => ({ type: i.type, hasImage: withImage.has(i.id), hasPrice: itemHasPrice(i, now), categoryId: i.category_id, isAvailable: i.is_available, isVisible: i.is_visible })),
      catalogsWithCategories.has(catalog.id),
    );
    countsByBusiness.set(catalog.business_id, {
      noPhoto: review['sin-foto'].count,
      noPrice: review['sin-precio'].count,
      noCategory: review['sin-categoria'].count,
      pendingReviews: pendingReviews.get(catalog.business_id) ?? 0,
    });
  }

  const recentlySent = new Set(recent.map((r) => `${r.user_id}:${r.business_id}`));
  const eligible = members.filter((m) => businessName.has(m.business_id));
  const due: CatalogReviewRecipient[] = [];
  for (const member of eligible) {
    const counts = countsByBusiness.get(member.business_id);
    if (!counts || reviewTotal(counts) === 0 || recentlySent.has(`${member.user_id}:${member.business_id}`)) continue;
    const profile = profileById.get(member.user_id)!;
    due.push({
      userId: member.user_id,
      email: profile.email!,
      name: profile.full_name,
      locale: isLocale(profile.locale) ? profile.locale : 'es',
      businessId: member.business_id,
      businessName: businessName.get(member.business_id)!,
      counts,
    });
  }
  return { candidates: eligible.length, due };
}

export async function runCatalogReview({ now = new Date(), dryRun = false } = {}): Promise<CatalogReviewSummary> {
  const send = !dryRun && isEmailConfigured() && Boolean(linkSecret());
  const { candidates, due } = await findCatalogReviewRecipients(now);
  const summary: CatalogReviewSummary = { dryRun: !send, candidates, due: due.length, sent: 0, failed: 0, deferred: Math.max(0, due.length - MAX_SENDS) };
  if (!send) return summary;

  const db = createAdminClient();
  const week = `${now.getUTCFullYear()}-${Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / (7 * 86_400_000))}`;
  for (const [index, recipient] of due.slice(0, MAX_SENDS).entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
    const unsubscribe = unsubscribeUrl(recipient.userId);
    const email = buildCatalogReviewEmail({
      locale: recipient.locale,
      recipientName: recipient.name,
      businessName: recipient.businessName,
      counts: recipient.counts,
      appName: env.appName,
      dashboardUrl: `${env.siteUrl}/dashboard`,
      unsubscribeUrl: unsubscribe,
    });
    const result = await sendEmail({
      to: recipient.email,
      ...email,
      // Baja en un clic desde el cliente de correo (RFC 8058).
      headers: { 'List-Unsubscribe': `<${oneClickUnsubscribeUrl(recipient.userId)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      idempotencyKey: `catalog-review/${recipient.userId}/${recipient.businessId}/${week}`,
    });
    if (!result.ok) {
      summary.failed++;
      console.error('[catalog-review] no se pudo enviar', { error: result.error });
      continue;
    }
    summary.sent++;
    const { error } = await db.from('notification_log').insert({ user_id: recipient.userId, business_id: recipient.businessId, kind: 'catalog_review' });
    if (error) console.error('[catalog-review] no se pudo registrar el envío', { code: error.code });
  }
  return summary;
}
