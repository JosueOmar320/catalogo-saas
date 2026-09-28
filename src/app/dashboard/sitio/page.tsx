import type { Metadata } from 'next';
import { Builder } from '@/features/builder/components/Builder';
import { getBuilderData } from '@/features/builder/queries';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { publicStorageUrl } from '@/lib/utils/storage';

export const metadata: Metadata = { title: 'Editor del sitio' };

const PANELS = ['pages', 'navigation', 'design'] as const;
const DESIGN_TABS = ['theme', 'colors', 'type', 'style', 'background', 'cards'] as const;

export default async function SiteBuilderPage({ searchParams }: PageProps<'/dashboard/sitio'>) {
  const ctx = await requireBusinessContext();
  const [{ panel, tab }, data] = await Promise.all([searchParams, getBuilderData(ctx)]);

  return (
    <Builder
      key={ctx.business.id}
      site={data.site}
      persistedPageIds={data.persistedPageIds}
      isStarter={data.isStarter}
      usesSampleItems={data.usesSampleItems}
      canManage={canManageCatalog(ctx)}
      initialPanel={PANELS.find((p) => p === panel) ?? 'pages'}
      initialDesignTab={DESIGN_TABS.find((t) => t === tab)}
      identity={{
        logoUrl: publicStorageUrl(ctx.business.logo_path),
        coverUrl: publicStorageUrl(ctx.catalog.cover_path),
        faviconUrl: publicStorageUrl(ctx.catalog.favicon_path),
      }}
    />
  );
}
