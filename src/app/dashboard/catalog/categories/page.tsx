import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { listCategories, listItemsWithImages } from '@/features/catalog/queries';
import { CategoryManager } from '@/features/categories/components/CategoryManager';
import { requireBusinessContext } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Categorías' };

export default async function CategoriesPage() {
  const ctx = await requireBusinessContext();
  const [categories, items] = await Promise.all([listCategories(ctx), listItemsWithImages(ctx)]);
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.category_id) counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title="Categorías" description="Agrupan tus productos y servicios, y forman el menú de navegación del catálogo. Arrastra o usa las flechas para ordenarlas." />
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          imagePath: c.image_path,
          isActive: c.is_active,
          itemCount: counts.get(c.id) ?? 0,
        }))}
      />
    </>
  );
}
