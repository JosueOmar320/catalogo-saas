import type { Metadata } from 'next';
import { AppShell } from '@/components/dashboard/AppShell';
import { DashboardProvider } from '@/components/dashboard/DashboardContext';
import { appFont } from '@/components/providers/app-font';
import { AppProviders } from '@/components/providers/AppProviders';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { catalogUrl } from '@/lib/catalog/view-model';
import { publicStorageUrl } from '@/lib/utils/storage';

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusinessContext();

  return (
    <div className={appFont.variable}>
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
          }}
        >
          <AppShell
            businessMenu={{
              current: { id: ctx.business.id, name: ctx.business.name, logoUrl: publicStorageUrl(ctx.business.logo_path) },
              businesses: ctx.businesses,
              email: ctx.email,
              planName: ctx.entitlements.planName,
            }}
          >
            {children}
          </AppShell>
        </DashboardProvider>
      </AppProviders>
    </div>
  );
}
