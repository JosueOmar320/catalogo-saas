import type { Metadata } from 'next';
import { ItemsPage } from '@/features/items/components/ItemsPage';

export const metadata: Metadata = { title: 'Servicios' };

export default function ServicesPage() {
  return <ItemsPage type="service" />;
}
