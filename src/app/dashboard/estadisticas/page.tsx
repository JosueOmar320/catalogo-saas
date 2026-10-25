import { Alert } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { AnalyticsBoard } from '@/features/analytics/components/AnalyticsBoard';
import { getAnalytics } from '@/features/analytics/queries';
import { getLocale, getT } from '@/i18n/server';
import { parseAnalyticsRange } from '@/lib/analytics/summary';
import { requireCatalogFeature } from '@/lib/auth/session';
import { parseCatalogSettings } from '@/lib/catalog/settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Estadísticas') };
}

export default async function AnalyticsPage({ searchParams }: PageProps<'/dashboard/estadisticas'>) {
  const ctx = await requireCatalogFeature('analytics');
  const { dias } = await searchParams;
  const range = parseAnalyticsRange(dias);
  const [t, locale, data] = await Promise.all([getT(), getLocale(), getAnalytics(ctx, range)]);
  const settings = parseCatalogSettings(ctx.catalog.settings);

  return (
    <>
      <PageHeader title={t('Estadísticas')} description={t('Cuántos visitan tu sitio, de dónde llegan, cuántos te piden y cómo va contra el periodo anterior.')} />
      {data === null ? (
        <Alert severity="warning">{t('No se pudieron cargar las estadísticas. Intenta de nuevo en unos minutos.')}</Alert>
      ) : (
        <AnalyticsBoard
          summary={data.summary}
          products={data.products}
          siteUrl={ctx.publicUrl}
          published={ctx.catalog.status === 'published'}
          ordersEnabled={settings.order.enabled}
          currency={settings.currency}
          priceLocale={settings.locale}
          locale={locale}
        />
      )}
    </>
  );
}
