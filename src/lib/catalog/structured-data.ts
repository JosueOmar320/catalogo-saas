import type { CatalogItemView } from '@/lib/catalog/view-model';
import { pagePath } from '@/lib/site/links';
import type { SiteViewModel } from '@/lib/site/view-model';

/**
 * Datos estructurados (schema.org) de la ficha de un producto o servicio:
 * precio (o rango, si tiene opciones), disponibilidad, fin de la oferta y la
 * ruta Catálogo › Categoría › Producto para los buscadores.
 */
export function itemJsonLd(site: SiteViewModel, item: CatalogItemView) {
  const availability = (available: boolean) => (available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock');
  const prices = (item.variants?.options ?? []).map((o) => o.price).filter((p): p is number => p !== null);
  const offers = item.variants && prices.length
    ? {
        '@type': 'AggregateOffer',
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: item.variants.options.length,
        priceCurrency: item.currency,
        availability: availability(item.isAvailable),
        url: item.url,
      }
    : item.price !== null
      ? {
          '@type': 'Offer',
          price: item.price,
          priceCurrency: item.currency,
          availability: availability(item.isAvailable),
          url: item.url,
          ...(item.saleEndsOn ? { priceValidUntil: item.saleEndsOn } : {}),
        }
      : undefined;

  const category = site.categories.find((c) => c.id === item.categoryId);
  // La categoría enlaza a la página con el catálogo, filtrada (igual que la sección "Categorías").
  const catalogPage = site.pages.find((p) => p.sections.some((s) => s.type === 'catalog'));
  const crumbs = [
    { name: site.business.name, item: site.url },
    ...(category && catalogPage ? [{ name: category.name, item: `${pagePath(site.url, catalogPage)}?categoria=${category.id}` }] : []),
    { name: item.name, item: item.url },
  ];

  return [
    {
      '@context': 'https://schema.org',
      '@type': item.type === 'service' ? 'Service' : 'Product',
      name: item.name,
      description: item.shortDescription ?? item.description ?? undefined,
      image: item.images.map((i) => i.url),
      sku: item.sku ?? undefined,
      url: item.url,
      ...(category ? { category: category.name } : {}),
      ...(item.type === 'service' ? { provider: { '@type': 'Organization', name: site.business.name } } : { brand: { '@type': 'Brand', name: site.business.name } }),
      ...(offers ? { offers } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: crumb.item })),
    },
  ];
}
