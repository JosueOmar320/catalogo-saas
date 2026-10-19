'use client';

import { Box, Typography } from '@mui/material';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import { useT } from '@/i18n/client';
import { formatPrice } from '@/lib/utils/format';
import { priceToNumber } from '@/lib/utils/validation';
import { publicStorageUrl } from '@/lib/utils/storage';
import { ItemCard } from '@/site-renderer/ItemCard';
import { SiteShell } from '@/site-renderer/SiteShell';
import { variantPriceSummary } from '@/lib/catalog/variants';
import { formVariants, type ItemFormValues } from '../schema';

/** Vista previa en vivo de la tarjeta, con el mismo componente del sitio público. */
export function ItemCardPreview({ site, values, categoryName }: { site: SiteViewModel; values: ItemFormValues; categoryName?: string }) {
  const t = useT();
  const basePrice = priceToNumber(values.price ?? '');
  const variants = formVariants({ variantsEnabled: values.variantsEnabled ?? false, variantsLabel: values.variantsLabel ?? '', variants: values.variants ?? [] });
  // Igual que en el sitio: con opciones, el menor precio y "desde" si varían.
  const summary = variantPriceSummary(basePrice !== null && Number.isNaN(basePrice) ? null : basePrice, variants);
  const price = summary.price;
  const compareAt = variants ? null : priceToNumber(values.compareAtPrice ?? '');
  const locale = site.settings.locale;
  const item: CatalogItemView = {
    id: 'preview',
    slug: 'preview',
    type: values.type,
    name: values.name || t('Nombre del ítem'),
    shortDescription: values.shortDescription || null,
    description: null,
    price,
    compareAtPrice: compareAt,
    currency: values.currency,
    priceLabel: price === null || Number.isNaN(price) ? null : formatPrice(price, values.currency, locale, site.settings.priceFormat),
    compareAtLabel: compareAt !== null && price !== null && compareAt > price ? formatPrice(compareAt, values.currency, locale) : null,
    priceNote: values.priceNote || (summary.from ? 'desde' : null),
    sku: values.sku || null,
    isAvailable: values.isAvailable,
    isFeatured: values.isFeatured,
    tags: values.tags ?? [],
    categoryId: null,
    images: (values.images ?? []).map((image) => {
      const url = publicStorageUrl(image.path) ?? '';
      return { url, thumbUrl: publicStorageUrl(image.thumbPath ?? image.path) ?? url, width: image.width ?? null, height: image.height ?? null, alt: image.alt ?? '' };
    }),
    badges: values.badges ?? [],
    customBadge: values.customBadgeLabel ? { label: values.customBadgeLabel, color: values.customBadgeColor } : null,
    attributes: values.attributeValues ?? {},
    createdAt: new Date(0).toISOString(),
    url: site.url,
    variants: null,
  };

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">{t('Así se verá')}</Typography>
      <Box sx={{ mt: 1, borderRadius: 1.5, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        <SiteShell theme={site.theme} language={site.settings.language}>
          <Box sx={{ p: 2, maxWidth: 280, mx: 'auto', width: '100%' }}>
            <ItemCard item={item} site={site} env={{ mode: 'preview', basePath: '', currentPageId: null }} options={{ categoryName }} />
          </Box>
        </SiteShell>
      </Box>
    </Box>
  );
}
