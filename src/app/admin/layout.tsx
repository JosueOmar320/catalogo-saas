import type { Metadata } from 'next';
import { AppShell } from '@/components/dashboard/AppShell';
import { appFont } from '@/components/providers/app-font';
import { AppProviders } from '@/components/providers/AppProviders';
import { AppI18n } from '@/i18n/AppI18n';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { default: t('Administración'), template: t('%s · Administración') }, robots: { index: false, follow: false } };
}

/** Panel de la plataforma: sólo administradores activos (la base lo vuelve a verificar en cada operación). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePlatformAdmin();
  return (
    <div className={appFont.variable}>
      <AppI18n>
      <AppProviders>
        <AppShell variant="admin" account={{ username: profile.username, fullName: profile.full_name, isAdmin: true }}>
          {children}
        </AppShell>
      </AppProviders>
      </AppI18n>
    </div>
  );
}
