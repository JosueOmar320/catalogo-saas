import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ItemDetail } from '@/site-renderer';
import { getPublicSite } from '@/features/catalog/public-queries';
import { siteMetadata } from '@/lib/catalog/metadata';
import { siteStatusTexts } from '@/site-renderer/status';

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

async function load(slug: string, itemSlug: string) {
  const site = await getPublicSite(slug);
  const item = site?.items.find((i) => i.slug === itemSlug);
  return site && item ? { site, item } : null;
}

export async function generateMetadata({ params }: PageProps<'/catalogo/[slug]/p/[itemSlug]'>): Promise<Metadata> {
  const { slug, itemSlug } = await params;
  const data = await load(slug, itemSlug);
  if (!data) return { title: siteStatusTexts((await getPublicSite(slug))?.settings.language).notFound, robots: { index: false } };
  const { site, item } = data;
  const base = siteMetadata(site);
  const description = item.shortDescription ?? (base.description as string);
  const image = item.images[0]?.url;
  return {
    title: item.name,
    description,
    alternates: { canonical: item.url },
    openGraph: { ...base.openGraph, url: item.url, title: `${item.name} · ${site.business.name}`, description, images: image ? [{ url: image }] : base.openGraph?.images },
    twitter: { card: 'summary_large_image', title: item.name, description, images: image ? [image] : undefined },
  };
}

export default async function ItemPage({ params }: PageProps<'/catalogo/[slug]/p/[itemSlug]'>) {
  const { slug, itemSlug } = await params;
  const data = await load(slug, itemSlug);
  if (!data) notFound();
  const { site, item } = data;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': item.type === 'service' ? 'Service' : 'Product',
    name: item.name,
    description: item.shortDescription ?? item.description ?? undefined,
    image: item.images.map((i) => i.url),
    sku: item.sku ?? undefined,
    url: item.url,
    ...(item.type === 'service' ? { provider: { '@type': 'Organization', name: site.business.name } } : { brand: { '@type': 'Brand', name: site.business.name } }),
    ...(item.price !== null && {
      offers: {
        '@type': 'Offer',
        price: item.price,
        priceCurrency: item.currency,
        availability: item.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: item.url,
      },
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ItemDetail site={site} item={item} backHref={`/catalogo/${slug}`} />
    </>
  );
}
