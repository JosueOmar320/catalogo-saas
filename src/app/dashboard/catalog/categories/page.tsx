import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { listCategories, listItemsWithImages } from '@/features/catalog/queries';
import { CategoryManager } from '@/features/categories/components/CategoryManager';
import { requireBusinessContext } from '@/lib/auth/session';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Categorías') };
}

export default async function CategoriesPage() {
  const ctx = await requireBusinessContext();
  const [categories, items, t] = await Promise.all([listCategories(ctx), listItemsWithImages(ctx), getT()]);
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.category_id) counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title={t('Categorías')} description={t('Agrupan tus productos y servicios, y forman el menú de navegación del catálogo. Arrastra o usa las flechas para ordenarlas.')} />
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
