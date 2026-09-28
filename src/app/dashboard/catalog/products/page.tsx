import type { Metadata } from 'next';
import { ItemsPage } from '@/features/items/components/ItemsPage';

export const metadata: Metadata = { title: 'Productos' };

export default function ProductsPage() {
  return <ItemsPage type="product" />;
}
