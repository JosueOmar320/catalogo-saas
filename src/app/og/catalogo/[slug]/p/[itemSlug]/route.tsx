import { itemCard } from '@/features/og/cards';
import { getPublicSite } from '@/features/catalog/public-queries';

/** Imagen para compartir un producto o servicio: foto, nombre, precio y negocio. */
export const revalidate = 3600;

export async function GET(_request: Request, { params }: RouteContext<'/og/catalogo/[slug]/p/[itemSlug]'>) {
  const { slug, itemSlug } = await params;
  const site = await getPublicSite(slug);
  const item = site?.items.find((i) => i.slug === itemSlug);
  if (!site || !item) return new Response(null, { status: 404 });
  return itemCard(site, item);
}
