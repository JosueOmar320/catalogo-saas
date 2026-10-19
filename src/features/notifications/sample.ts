import 'server-only';
import type { Locale } from '@/i18n/config';
import { buildCatalogReviewEmail } from '@/lib/email/catalog-review';
import { env } from '@/lib/env';
import { unsubscribeUrl } from './catalog-review';

/** Aviso de ejemplo (vista previa y correo de prueba del admin). */
export function sampleCatalogReviewEmail(locale: Locale, name: string | null, userId: string) {
  return buildCatalogReviewEmail({
    locale,
    recipientName: name,
    businessName: 'Café Aurora',
    counts: { noPhoto: 3, noPrice: 1, noCategory: 2 },
    appName: env.appName,
    dashboardUrl: `${env.siteUrl}/dashboard`,
    unsubscribeUrl: unsubscribeUrl(userId),
  });
}
