import { Package, Plus, Wrench } from 'lucide-react';
import { Box } from '@mui/material';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { getT } from '@/i18n/server';
import { itemThumbnail, listCategories, listItemsWithImages } from '@/features/catalog/queries';
import { requireBusinessContext } from '@/lib/auth/session';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { formatPrice } from '@/lib/utils/format';
import type { ItemType } from '@/types/database';
import { ITEM_TYPE_LABELS } from '../schema';
import { ItemsTable, type ItemRowData } from './ItemsTable';

/** Página de listado compartida por Productos y Servicios. */
export async function ItemsPage({ type }: { type: ItemType }) {
  const ctx = await requireBusinessContext();
  const t = await getT();
  const [categories, items] = await Promise.all([listCategories(ctx), listItemsWithImages(ctx)]);
  const { locale } = parseCatalogSettings(ctx.catalog.settings);
  const labels = ITEM_TYPE_LABELS[type];
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  const rows: ItemRowData[] = items
    .filter((i) => i.type === type)
    .map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      categoryId: i.category_id,
      categoryName: i.category_id ? (categoryNames.get(i.category_id) ?? null) : null,
      priceLabel: i.price === null ? null : formatPrice(Number(i.price), i.currency, locale),
      thumbUrl: itemThumbnail(i),
      isVisible: i.is_visible,
      isAvailable: i.is_available,
      isFeatured: i.is_featured,
    }));

  const newHref = `/dashboard/catalog/items/new?type=${type}`;

  return (
    <>
      <PageHeader
        title={t(labels.plural)}
        description={
          type === 'product'
            ? t('Artículos que vendes: con precio, fotos y disponibilidad.')
            : t('Lo que ofreces como servicio: con precio fijo, "desde" o a cotizar.')
        }
        actions={
          <LinkButton href={newHref} variant="contained" startIcon={<Plus size={15} />}>
            {t(labels.newLabel)}
          </LinkButton>
        }
      />
      {rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={type === 'product' ? Package : Wrench}
            title={type === 'product' ? t('Aún no tienes productos') : t('Aún no tienes servicios')}
            description={t('Crear uno toma menos de un minuto: nombre, precio y una foto.')}
            action={
              <Box>
                <LinkButton href={newHref} variant="contained" startIcon={<Plus size={15} />}>
                  {t(labels.newLabel)}
                </LinkButton>
              </Box>
            }
          />
        </SectionCard>
      ) : (
        <ItemsTable items={rows} categories={categories.map(({ id, name }) => ({ id, name }))} />
      )}
    </>
  );
}
