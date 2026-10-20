import { Package, Plus, Wrench } from 'lucide-react';
import { Box } from '@mui/material';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { getLocale, getT } from '@/i18n/server';
import { itemThumbnail, listCategories, listItemCosts, listItemsWithImages } from '@/features/catalog/queries';
import { requireBusinessContext } from '@/lib/auth/session';
import { parseItemAttributes } from '@/lib/catalog/item-attributes';
import { formatSaleDate, isSaleOver } from '@/lib/catalog/sale';
import { itemUrl } from '@/lib/catalog/view-model';
import { marginOf } from '@/lib/catalog/margin';
import { seasonStatus } from '@/lib/catalog/season';
import { parseCatalogSettings } from '@/lib/catalog/settings';
import { formatPrice } from '@/lib/utils/format';
import type { ItemType } from '@/types/database';
import type { ReviewFilter } from '../review';
import { ITEM_TYPE_LABELS } from '../schema';
import { getItemPerformance } from '@/features/views/queries';
import { matchKey } from '@/lib/catalog/csv';
import { ImportExport } from './ImportExport';
import { PhotoBatchButton } from './PhotoBatch';
import { ItemsTable, type ItemRowData } from './ItemsTable';

/** Página de listado compartida por Productos y Servicios. */
export async function ItemsPage({ type, review }: { type: ItemType; review?: ReviewFilter | null }) {
  const ctx = await requireBusinessContext();
  const t = await getT();
  const [categories, items, performance, costs] = await Promise.all([listCategories(ctx), listItemsWithImages(ctx), getItemPerformance(ctx), listItemCosts(ctx)]);
  const { locale } = parseCatalogSettings(ctx.catalog.settings);
  const labels = ITEM_TYPE_LABELS[type];
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  const now = new Date();
  const panelLocale = await getLocale();
  const saleOf = (i: (typeof items)[number]): ItemRowData['sale'] => {
    const ends = parseItemAttributes(i.attributes).saleEnds;
    return ends && i.compare_at_price !== null ? { ends: formatSaleDate(ends.on, panelLocale), over: isSaleOver(ends, now) } : null;
  };
  // Temporada: sólo se avisa cuando hoy no se ve en el sitio.
  const seasonOf = (i: (typeof items)[number]): ItemRowData['season'] => {
    const season = parseItemAttributes(i.attributes).season;
    const status = seasonStatus(season, now);
    if (!season || status === 'active') return null;
    return status === 'upcoming' ? { status, date: formatSaleDate(season.from, panelLocale) } : { status: 'ended', date: formatSaleDate(season.until, panelLocale) };
  };
  const rows: ItemRowData[] = items
    .filter((i) => i.type === type)
    .map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      categoryId: i.category_id,
      categoryName: i.category_id ? (categoryNames.get(i.category_id) ?? null) : null,
      priceLabel: i.price === null ? null : formatPrice(Number(i.price), i.currency, locale),
      price: i.price === null ? null : Number(i.price),
      currency: i.currency,
      thumbUrl: itemThumbnail(i),
      isVisible: i.is_visible,
      isAvailable: i.is_available,
      isFeatured: i.is_featured,
      sale: saleOf(i),
      hasDescription: Boolean(i.short_description || i.description),
      stock: parseItemAttributes(i.attributes).stock,
      season: seasonOf(i),
      url: itemUrl(ctx.business.slug, i.slug),
      cost: costs.get(i.id) ?? null,
      margin: marginOf(i.price === null ? null : Number(i.price), costs.get(i.id) ?? null)?.percent ?? null,
      views: performance.views ? (performance.views[i.id] ?? 0) : null,
      units: performance.units ? (performance.units[i.id] ?? 0) : null,
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
          <>
            <ImportExport existingKeys={items.map(matchKey)} categoryNames={categories.map((c) => c.name)} defaultType={type} />
            <PhotoBatchButton businessId={ctx.business.id} type={type} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
            <LinkButton href={newHref} variant="contained" startIcon={<Plus size={15} />}>
              {t(labels.newLabel)}
            </LinkButton>
          </>
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
        <ItemsTable key={review ?? 'all'} items={rows} categories={categories.map(({ id, name }) => ({ id, name }))} initialReview={review} locale={locale} businessName={ctx.business.name} />
      )}
    </>
  );
}
