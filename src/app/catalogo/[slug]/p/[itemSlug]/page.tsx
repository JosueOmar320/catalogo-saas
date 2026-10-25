import type { Metadata } from 'next';
import { itemMetadata, renderItemPage } from './item-page';

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/catalogo/[slug]/p/[itemSlug]'>): Promise<Metadata> {
  const { slug, itemSlug } = await params;
  return itemMetadata(slug, itemSlug);
}

export default async function ItemPage({ params }: PageProps<'/catalogo/[slug]/p/[itemSlug]'>) {
  const { slug, itemSlug } = await params;
  return renderItemPage(slug, itemSlug, `/catalogo/${slug}`);
}
