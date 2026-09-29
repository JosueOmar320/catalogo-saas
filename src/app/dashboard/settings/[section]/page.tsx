import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SETTINGS_SECTIONS } from '@/components/dashboard/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { listItemsWithImages } from '@/features/catalog/queries';
import { BusinessProfileForm } from '@/features/settings/components/BusinessProfileForm';
import { ContactForm } from '@/features/settings/components/ContactForm';
import { PublishingPanel } from '@/features/settings/components/PublishingPanel';
import { SeoForm } from '@/features/settings/components/SeoForm';
import { SocialLinksForm } from '@/features/settings/components/SocialLinksForm';
import { requireBusinessContext } from '@/lib/auth/session';
import { parseContact, parseSocialLinks } from '@/lib/business/profile';
import { parseCatalogSettings, parseSeo } from '@/lib/catalog/settings';
import { catalogUrl } from '@/lib/catalog/view-model';

export async function generateMetadata({ params }: PageProps<'/dashboard/settings/[section]'>): Promise<Metadata> {
  const { section } = await params;
  return { title: SETTINGS_SECTIONS.find((s) => s.id === section)?.label ?? 'Configuración' };
}

export default async function SettingsPage({ params }: PageProps<'/dashboard/settings/[section]'>) {
  const { section } = await params;
  const meta = SETTINGS_SECTIONS.find((s) => s.id === section);
  if (!meta) notFound();
  const ctx = await requireBusinessContext();
  const settings = parseCatalogSettings(ctx.catalog.settings);
  const url = catalogUrl(ctx.business.slug);

  let content: React.ReactNode;
  switch (meta.id) {
    case 'negocio':
      content = (
        <BusinessProfileForm
          defaultValues={{ name: ctx.business.name, slug: ctx.business.slug, slogan: ctx.business.slogan ?? '', description: ctx.business.description ?? '' }}
          currency={settings.currency}
          priceFormat={settings.priceFormat}
        />
      );
      break;
    case 'contacto':
      content = <ContactForm contact={parseContact(ctx.business.contact)} actions={settings.contactActions} businessName={ctx.business.name} />;
      break;
    case 'redes':
      content = <SocialLinksForm links={parseSocialLinks(ctx.business.social_links)} />;
      break;
    case 'seo':
      content = (
        <SeoForm
          seo={parseSeo(ctx.catalog.seo)}
          fallbackTitle={ctx.business.name}
          fallbackDescription={ctx.business.description ?? `Catálogo de ${ctx.business.name}`}
          url={url}
        />
      );
      break;
    case 'publicacion': {
      const items = await listItemsWithImages(ctx);
      const visible = items.filter((i) => i.is_visible).length;
      content = (
        <PublishingPanel status={ctx.catalog.status} url={url} publishedAt={ctx.catalog.published_at} visibleItems={visible} hiddenItems={items.length - visible} />
      );
      break;
    }
  }

  return (
    <>
      <PageHeader title={meta.label} />
      {content}
    </>
  );
}
