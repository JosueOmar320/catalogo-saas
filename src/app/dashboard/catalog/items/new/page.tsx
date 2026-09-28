import type { Metadata } from 'next';
import { getSiteForAdmin, listCategories } from '@/features/catalog/queries';
import { ItemForm } from '@/features/items/components/ItemForm';
import { emptyItemValues } from '@/features/items/defaults';
import { requireBusinessContext } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Nuevo ítem' };

export default async function NewItemPage({ searchParams }: PageProps<'/dashboard/catalog/items/new'>) {
  const ctx = await requireBusinessContext();
  const { type, category } = await searchParams;
  const [categories, site] = await Promise.all([listCategories(ctx), getSiteForAdmin(ctx)]);
  const values = emptyItemValues(type === 'service' ? 'service' : 'product', site.settings.currency);
  if (typeof category === 'string' && categories.some((c) => c.id === category)) values.categoryId = category;

  return (
    <ItemForm
      itemId={null}
      defaultValues={values}
      categories={categories.map(({ id, name }) => ({ id, name }))}
      previewSite={site}
    />
  );
}
