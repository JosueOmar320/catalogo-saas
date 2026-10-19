import type { Metadata } from 'next';
import { ItemsPage } from '@/features/items/components/ItemsPage';
import { isReviewFilter } from '@/features/items/review';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Productos') };
}

export default async function ProductsPage({ searchParams }: PageProps<'/dashboard/catalog/products'>) {
  const { revisar } = await searchParams;
  return <ItemsPage type="product" review={isReviewFilter(revisar) ? revisar : null} />;
}
