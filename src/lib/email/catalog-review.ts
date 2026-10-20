import type { Locale } from '@/i18n/config';
import { APP_EN } from '@/i18n/en';
import { createTranslator } from '@/i18n/translate';

/**
 * Correo semanal con los pendientes de "Revisa tu catálogo". Puro (sin envío
 * ni base): devuelve asunto, HTML y texto plano en el idioma del usuario.
 * El HTML es simple y con estilos en línea para que se vea igual en Gmail,
 * Outlook y Apple Mail; los datos del negocio se escapan.
 */
export type CatalogReviewCounts = {
  noPhoto: number;
  noPrice: number;
  noCategory: number;
  /** Reseñas de clientes esperando aprobación. */
  pendingReviews?: number;
};

export type CatalogReviewEmailInput = {
  locale: Locale;
  recipientName: string | null;
  businessName: string;
  counts: CatalogReviewCounts;
  appName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
};

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const reviewTotal = (counts: CatalogReviewCounts) => counts.noPhoto + counts.noPrice + counts.noCategory + (counts.pendingReviews ?? 0);

export function buildCatalogReviewEmail(input: CatalogReviewEmailInput): { subject: string; html: string; text: string } {
  const t = createTranslator(input.locale, APP_EN);
  const { counts, businessName } = input;
  const total = reviewTotal(counts);

  const subject = total === 1 ? t('{business}: 1 detalle para mejorar tu catálogo', { business: businessName }) : t('{business}: {count} detalles para mejorar tu catálogo', { business: businessName, count: total });
  const greeting = input.recipientName?.trim() ? t('Hola, {name}:', { name: input.recipientName.trim() }) : t('Hola:');
  const intro = t('Esta semana, el catálogo de {business} tiene algunos pendientes:', { business: businessName });
  const lines = [
    counts.noPhoto && (counts.noPhoto === 1 ? t('1 producto o servicio sin foto') : t('{count} productos o servicios sin foto', { count: counts.noPhoto })),
    counts.noPrice && (counts.noPrice === 1 ? t('1 producto sin precio') : t('{count} productos sin precio', { count: counts.noPrice })),
    counts.noCategory && (counts.noCategory === 1 ? t('1 producto o servicio sin categoría') : t('{count} productos o servicios sin categoría', { count: counts.noCategory })),
    counts.pendingReviews && (counts.pendingReviews === 1 ? t('1 reseña de un cliente por aprobar') : t('{count} reseñas de clientes por aprobar', { count: counts.pendingReviews })),
  ].filter((line): line is string => Boolean(line));
  const tip = t('Las fotos y los precios son lo primero que miran tus clientes: completarlos ayuda a que te escriban.');
  const cta = t('Revisar mi catálogo');
  const why = t('Recibes este aviso semanal porque administras {business} en {app}. Sólo llega si hay pendientes.', { business: businessName, app: input.appName });
  const unsubscribe = t('Dejar de recibir estos avisos');

  const text = [greeting, '', intro, '', ...lines.map((line) => `• ${line}`), '', tip, '', `${cta}: ${input.dashboardUrl}`, '', '—', why, `${unsubscribe}: ${input.unsubscribeUrl}`].join('\n');

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#2f54d6;">${escape(input.appName)}</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${escape(subject)}</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escape(greeting)}</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escape(intro)}</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;">
      ${lines.map((line) => `<li>${escape(line)}</li>`).join('\n      ')}
    </ul>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#52525b;">${escape(tip)}</p>
    <a href="${escape(input.dashboardUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">${escape(cta)}</a>
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
    ${escape(why)}<br><a href="${escape(input.unsubscribeUrl)}" style="color:#71717a;">${escape(unsubscribe)}</a>
  </p>
</body>
</html>`;

  return { subject, html, text };
}
