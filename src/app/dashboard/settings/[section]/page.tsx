import { Stack } from '@mui/material';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SETTINGS_SECTIONS } from '@/components/dashboard/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { listItemsWithImages } from '@/features/catalog/queries';
import { BusinessProfileForm } from '@/features/settings/components/BusinessProfileForm';
import { CustomDomainCard } from '@/features/settings/components/CustomDomainCard';
import { ContactForm } from '@/features/settings/components/ContactForm';
import { OrderSettingsForm } from '@/features/settings/components/OrderSettingsForm';
import { PublishingPanel } from '@/features/settings/components/PublishingPanel';
import { SeoForm } from '@/features/settings/components/SeoForm';
import { SocialLinksForm } from '@/features/settings/components/SocialLinksForm';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { parseContact, parseSocialLinks } from '@/lib/business/profile';
import { catalogUrl } from '@/lib/catalog/view-model';
import { parseCatalogSettings, parseSeo } from '@/lib/catalog/settings';
import { isVercelConfigured } from '@/lib/domains/vercel';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';
import { getT } from '@/i18n/server';

export async function generateMetadata({ params }: PageProps<'/dashboard/settings/[section]'>): Promise<Metadata> {
  const { section } = await params;
  const t = await getT();
  const label = SETTINGS_SECTIONS.find((s) => s.id === section)?.label;
  return { title: label ? t(label) : t('Configuración') };
}

export default async function SettingsPage({ params }: PageProps<'/dashboard/settings/[section]'>) {
  const { section } = await params;
  const meta = SETTINGS_SECTIONS.find((s) => s.id === section);
  if (!meta) notFound();
  const ctx = await requireBusinessContext();
  const t = await getT();
  const settings = parseCatalogSettings(ctx.catalog.settings);
  const url = ctx.publicUrl;

  let content: React.ReactNode;
  switch (meta.id) {
    case 'negocio':
      content = (
        <BusinessProfileForm
          defaultValues={{ name: ctx.business.name, slug: ctx.business.slug, slogan: ctx.business.slogan ?? '', description: ctx.business.description ?? '' }}
          currency={settings.currency}
          language={settings.language}
          priceFormat={settings.priceFormat}
          catalog={ctx.siteKind === 'catalog'}
        />
      );
      break;
    case 'contacto':
      content = <ContactForm contact={parseContact(ctx.business.contact)} actions={settings.contactActions} businessName={ctx.business.name} catalog={ctx.siteKind === 'catalog'} />;
      break;
    case 'pedidos':
      if (ctx.siteKind !== 'catalog') notFound();
      content = <OrderSettingsForm contact={parseContact(ctx.business.contact)} order={settings.order} businessName={ctx.business.name} catalogUrl={url} />;
      break;
    case 'redes':
      content = <SocialLinksForm links={parseSocialLinks(ctx.business.social_links)} />;
      break;
    case 'seo':
      content = (
        <SeoForm
          seo={parseSeo(ctx.catalog.seo)}
          fallbackTitle={ctx.business.name}
          fallbackDescription={ctx.business.description ?? t('Catálogo de {name}', { name: ctx.business.name })}
          url={url}
        />
      );
      break;
    case 'publicacion': {
      const items = await listItemsWithImages(ctx);
      const visible = items.filter((i) => i.is_visible).length;
      content = (
        <Stack spacing={2.5}>
          <PublishingPanel status={ctx.catalog.status} url={url} publishedAt={ctx.catalog.published_at} visibleItems={visible} hiddenItems={items.length - visible} businessName={ctx.business.name} slug={ctx.business.slug} catalog={ctx.siteKind === 'catalog'} />
          <CustomDomainCard
            domain={ctx.business.custom_domain}
            status={ctx.business.custom_domain_status}
            availability={!ctx.features.custom_domain ? 'plan' : isVercelConfigured() && isServiceRoleConfigured() ? 'ok' : 'platform'}
            canManage={canManageCatalog(ctx)}
            platformUrl={catalogUrl(ctx.business.slug)}
          />
        </Stack>
      );
      break;
    }
  }

  return (
    <>
      <PageHeader title={t(meta.label)} />
      {content}
    </>
  );
}
