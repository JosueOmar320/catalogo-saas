import type { Metadata } from 'next';
import { ItemsPage } from '@/features/items/components/ItemsPage';
import { isReviewFilter } from '@/features/items/review';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Servicios') };
}

export default async function ServicesPage({ searchParams }: PageProps<'/dashboard/catalog/services'>) {
  const { revisar } = await searchParams;
  return <ItemsPage type="service" review={isReviewFilter(revisar) ? revisar : null} />;
}
