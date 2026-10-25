import type { NextRequest } from 'next/server';
import { getPublicSite } from '@/features/catalog/public-queries';

/** robots.txt del dominio propio: todo el sitio, salvo que el negocio pida no indexarlo. */
export async function GET(_request: NextRequest, { params }: RouteContext<'/dominio/[slug]/robots.txt'>) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  // site.url: el dominio propio activo (no el Host que llega, que puede venir de cualquier lado).
  const body = site && !site.seo.noindex ? `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
