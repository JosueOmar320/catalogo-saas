import { publishedCatalogsSitemap } from '@/features/seo/sitemap';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** sitemap.xml del dominio propio: sólo las páginas y fichas de este negocio (con sus URL en el dominio). */
export async function GET(_request: Request, { params }: RouteContext<'/dominio/[slug]/sitemap.xml'>) {
  const { slug } = await params;
  const entries = await publishedCatalogsSitemap({ businessSlug: slug });
  const urls = entries
    .map((e) => `  <url><loc>${escape(e.url)}</loc>${e.lastModified ? `<lastmod>${new Date(e.lastModified).toISOString()}</lastmod>` : ''}</url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
