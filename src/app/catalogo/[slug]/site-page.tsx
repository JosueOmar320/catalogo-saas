import { notFound, permanentRedirect } from 'next/navigation';
import { PageView } from '@/site-renderer';
import { getPublicSite } from '@/features/catalog/public-queries';
import { openingHoursSpecification, specialOpeningHoursSpecification } from '@/lib/business/schedule';
import { findHome } from '@/lib/site/pages';

/** Renderiza la página pedida (o la de inicio). Compartido por / y /[pageSlug]. */
export async function renderPublicPage(slug: string, pageSlug?: string) {
  const site = await getPublicSite(slug);
  if (!site) notFound();
  const home = findHome(site.pages);
  const page = pageSlug ? site.pages.find((p) => p.slug === pageSlug) : home;
  if (!page) notFound();
  // La página de inicio vive en la raíz: /catalogo/negocio/inicio → /catalogo/negocio
  if (pageSlug && page.id === home?.id) permanentRedirect(`/catalogo/${slug}`);

  const { schedule } = site.business.contact;
  const special = schedule.enabled ? specialOpeningHoursSpecification(schedule, new Date()) : [];
  const jsonLd = page.isHome
    ? {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: site.business.name,
        description: site.business.slogan ?? site.business.description ?? undefined,
        url: site.url,
        image: site.coverUrl ?? site.business.logoUrl ?? undefined,
        telephone: site.business.contact.phone || site.business.contact.whatsapp || undefined,
        email: site.business.contact.email || undefined,
        address: site.business.contact.address || undefined,
        sameAs: site.business.socialLinks.map((l) => l.url),
        openingHoursSpecification: site.business.contact.schedule.enabled ? openingHoursSpecification(site.business.contact.schedule) : undefined,
        // Feriados y horarios especiales próximos (la página se regenera cada hora).
        specialOpeningHoursSpecification: special.length ? special : undefined,
      }
    : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <PageView page={page} site={site} env={{ mode: 'public', basePath: `/catalogo/${slug}`, currentPageId: page.id }} />
    </>
  );
}
