import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteForAdmin, getItem, getItemCost, listCategories } from '@/features/catalog/queries';
import { ItemForm } from '@/features/items/components/ItemForm';
import { itemToFormValues } from '@/features/items/defaults';
import { requireBusinessContext } from '@/lib/auth/session';
import { uuidSchema } from '@/lib/utils/validation';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Editar ítem') };
}

export default async function EditItemPage({ params }: PageProps<'/dashboard/catalog/items/[itemId]'>) {
  const { itemId } = await params;
  if (!uuidSchema.safeParse(itemId).success) notFound();
  const ctx = await requireBusinessContext();
  const [item, categories, site, cost] = await Promise.all([getItem(ctx, itemId), listCategories(ctx), getSiteForAdmin(ctx), getItemCost(ctx, itemId)]);
  if (!item) notFound();

  return (
    <ItemForm
      key={item.updated_at}
      itemId={item.id}
      defaultValues={itemToFormValues(item, cost)}
      categories={categories.map(({ id, name }) => ({ id, name }))}
      previewSite={site}
    />
  );
}
