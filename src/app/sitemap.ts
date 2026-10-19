import type { MetadataRoute } from 'next';
import { publishedCatalogsSitemap } from '@/features/seo/sitemap';
import { env } from '@/lib/env';

/**
 * La plataforma y los catálogos publicados (inicio, páginas y fichas). Se arma
 * en cada pedido (los buscadores lo leen pocas veces): así no queda la versión
 * del build, que no conoce los catálogos que se publican después.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: env.siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${env.siteUrl}/demo`, changeFrequency: 'monthly', priority: 0.6 },
    ...(await publishedCatalogsSitemap()),
  ];
}
