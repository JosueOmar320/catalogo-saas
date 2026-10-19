import type { Metadata } from 'next';
import { ListOrdered, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { OrderBoard } from '@/features/catalog/components/OrderBoard';
import { itemThumbnail, listCategories, listItemsWithImages } from '@/features/catalog/queries';
import { requireBusinessContext } from '@/lib/auth/session';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Orden') };
}

export default async function OrderPage() {
  const ctx = await requireBusinessContext();
  const t = await getT();
  const [categories, items] = await Promise.all([listCategories(ctx), listItemsWithImages(ctx)]);

  return (
    <>
      <PageHeader title={t('Orden del catálogo')} description={t('Así es como tus clientes verán las secciones y los ítems. Los cambios se guardan automáticamente.')} />
      {items.length === 0 && categories.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={ListOrdered}
            title={t('Todavía no hay nada que ordenar')}
            description={t('Cuando tengas categorías y productos podrás arrastrarlos aquí para decidir en qué orden aparecen.')}
            action={
              <LinkButton href="/dashboard/catalog/items/new?type=product" variant="contained" startIcon={<Plus size={15} />}>
                {t('Nuevo producto')}
              </LinkButton>
            }
          />
        </SectionCard>
      ) : (
        <OrderBoard
          categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.is_active }))}
          items={items.map((i) => ({ id: i.id, name: i.name, categoryId: i.category_id, thumbUrl: itemThumbnail(i), isVisible: i.is_visible }))}
        />
      )}
    </>
  );
}
