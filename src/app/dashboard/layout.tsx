import type { Metadata } from 'next';
import { AppShell } from '@/components/dashboard/AppShell';
import { DashboardProvider } from '@/components/dashboard/DashboardContext';
import { appFont } from '@/components/providers/app-font';
import { AppProviders } from '@/components/providers/AppProviders';
import { AppI18n } from '@/i18n/AppI18n';
import { getT } from '@/i18n/server';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { catalogUrl } from '@/lib/catalog/view-model';
import { env } from '@/lib/env';
import { publicStorageUrl } from '@/lib/utils/storage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    // Con template: las páginas internas también llevan "· Vitrina" (un título plano lo cortaba).
    title: { default: t('Panel'), template: `%s · ${env.appName}` },
    robots: { index: false, follow: false },
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusinessContext();

  return (
    <div className={appFont.variable}>
      <AppI18n>
      <AppProviders>
        <DashboardProvider
          value={{
            businessId: ctx.business.id,
            businessName: ctx.business.name,
            businessSlug: ctx.business.slug,
            catalogId: ctx.catalog.id,
            catalogStatus: ctx.catalog.status,
            publicUrl: catalogUrl(ctx.business.slug),
            maxImagesPerItem: ctx.entitlements.limits.max_images_per_item,
            canManage: canManageCatalog(ctx),
            siteKind: ctx.siteKind,
          }}
        >
          <AppShell
            businessMenu={{
              current: { id: ctx.business.id, name: ctx.business.name, logoUrl: publicStorageUrl(ctx.business.logo_path) },
              businesses: ctx.businesses,
              username: ctx.profile.username,
              isAdmin: ctx.isPlatformAdmin,
              planName: ctx.entitlements.planName,
            }}
            siteKind={ctx.siteKind}
          >
            {children}
          </AppShell>
        </DashboardProvider>
      </AppProviders>
      </AppI18n>
    </div>
  );
}
