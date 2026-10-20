import { catalogCard } from '@/features/og/cards';
import { getPublicSite } from '@/features/catalog/public-queries';

/** Imagen para compartir el catálogo (si el negocio no subió una propia en SEO). */
export const revalidate = 3600;

export async function GET(_request: Request, { params }: RouteContext<'/og/catalogo/[slug]'>) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return new Response(null, { status: 404 });
  return catalogCard(site);
}
