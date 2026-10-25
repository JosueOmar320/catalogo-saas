import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ItemDetail } from '@/site-renderer';
import { getPublicSite } from '@/features/catalog/public-queries';
import { itemOgImage, siteMetadata } from '@/lib/catalog/metadata';
import { itemJsonLd } from '@/lib/catalog/structured-data';
import { siteStatusTexts } from '@/site-renderer/status';

/** Ficha de un ítem, compartida por /catalogo/<negocio>/p/… y el dominio propio (/p/…). */
async function load(slug: string, itemSlug: string) {
  const site = await getPublicSite(slug);
  const item = site?.items.find((i) => i.slug === itemSlug);
  return site && item ? { site, item } : null;
}

export async function itemMetadata(slug: string, itemSlug: string): Promise<Metadata> {
  const data = await load(slug, itemSlug);
  if (!data) return { title: siteStatusTexts((await getPublicSite(slug))?.settings.language).notFound, robots: { index: false } };
  const { site, item } = data;
  const base = siteMetadata(site);
  const description = item.shortDescription ?? (base.description as string);
  // Imagen generada: foto, nombre, precio y negocio (se ve al pegar el enlace en WhatsApp o redes).
  const image = itemOgImage(site, item.slug);
  return {
    title: item.name,
    description,
    alternates: { canonical: item.url },
    openGraph: { ...base.openGraph, url: item.url, title: `${item.name} · ${site.business.name}`, description, images: [{ url: image, width: 1200, height: 630, alt: item.name }] },
    twitter: { card: 'summary_large_image', title: item.name, description, images: [image] },
  };
}

export async function renderItemPage(slug: string, itemSlug: string, basePath: string) {
  const data = await load(slug, itemSlug);
  if (!data) notFound();
  const { site, item } = data;
  const jsonLd = itemJsonLd(site, item);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ItemDetail site={site} item={item} backHref={basePath || '/'} env={{ mode: 'public', basePath, currentPageId: null }} />
    </>
  );
}
