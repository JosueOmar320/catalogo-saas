import { Alert } from '@mui/material';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReviewsBoard } from '@/features/reviews/components/ReviewsBoard';
import { countPendingReviews, listReviews, PAGE } from '@/features/reviews/queries';
import { REVIEW_TABS } from '@/features/reviews/tabs';
import { getLocale, getT } from '@/i18n/server';
import { canManageCatalog, requireCatalogSite } from '@/lib/auth/session';
import { reviewInviteUrl } from '@/lib/catalog/reviews';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { catalogUrl } from '@/lib/catalog/view-model';

/** Momento del render (ms) para "hace 5 min". Server Component: una vez por petición, y el cliente lo reutiliza al hidratar. */
const requestNow = () => Date.now();

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Reseñas') };
}

export default async function ReviewsPage({ searchParams }: PageProps<'/dashboard/resenas'>) {
  const ctx = await requireCatalogSite();
  const { estado } = await searchParams;
  const status = REVIEW_TABS.find((tab) => tab.slug === estado)?.status ?? 'pending';
  const [t, locale, reviews, pending] = await Promise.all([getT(), getLocale(), listReviews(ctx, status), countPendingReviews(ctx)]);
  const settings = parseCatalogSettings(ctx.catalog.settings);

  return (
    <>
      <PageHeader title={t('Reseñas')} description={t('Lo que opinan tus clientes. Revisa cada reseña antes de que aparezca en tu sitio.')} />
      {reviews === null ? (
        <Alert severity="warning">{t('No se pudieron cargar las reseñas. Intenta de nuevo en unos minutos.')}</Alert>
      ) : (
        <ReviewsBoard
          status={status} reviews={reviews} pending={pending ?? 0} enabled={settings.reviews.enabled} canManage={canManageCatalog(ctx)} locale={locale} now={requestNow()}
          pageSize={PAGE}
          invite={{ url: reviewInviteUrl(catalogUrl(ctx.business.slug)), businessName: ctx.business.name, slug: ctx.business.slug, published: ctx.catalog.status === 'published' }}
        />
      )}
    </>
  );
}
