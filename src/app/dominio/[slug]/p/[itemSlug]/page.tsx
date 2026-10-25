import type { Metadata } from 'next';
import { itemMetadata, renderItemPage } from '@/app/catalogo/[slug]/p/[itemSlug]/item-page';

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/dominio/[slug]/p/[itemSlug]'>): Promise<Metadata> {
  const { slug, itemSlug } = await params;
  return itemMetadata(slug, itemSlug);
}

export default async function DomainItemPage({ params }: PageProps<'/dominio/[slug]/p/[itemSlug]'>) {
  const { slug, itemSlug } = await params;
  return renderItemPage(slug, itemSlug, '');
}
