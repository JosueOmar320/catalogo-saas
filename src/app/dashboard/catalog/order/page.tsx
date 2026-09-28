import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { OrderBoard } from '@/features/catalog/components/OrderBoard';
import { itemThumbnail, listCategories, listItemsWithImages } from '@/features/catalog/queries';
import { requireBusinessContext } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Orden' };

export default async function OrderPage() {
  const ctx = await requireBusinessContext();
  const [categories, items] = await Promise.all([listCategories(ctx), listItemsWithImages(ctx)]);

  return (
    <>
      <PageHeader title="Orden del catálogo" description="Así es como tus clientes verán las secciones y los ítems. Los cambios se guardan automáticamente." />
      <OrderBoard
        categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.is_active }))}
        items={items.map((i) => ({ id: i.id, name: i.name, categoryId: i.category_id, thumbUrl: itemThumbnail(i), isVisible: i.is_visible }))}
      />
    </>
  );
}
