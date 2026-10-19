import type { Metadata } from 'next';
import { ItemsPage } from '@/features/items/components/ItemsPage';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Servicios') };
}

export default function ServicesPage() {
  return <ItemsPage type="service" />;
}
