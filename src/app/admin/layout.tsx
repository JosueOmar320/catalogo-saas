import type { Metadata } from 'next';
import { AppShell } from '@/components/dashboard/AppShell';
import { appFont } from '@/components/providers/app-font';
import { AppProviders } from '@/components/providers/AppProviders';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: { default: 'Administración', template: '%s · Administración' }, robots: { index: false, follow: false } };

/** Panel de la plataforma: sólo administradores activos (la base lo vuelve a verificar en cada operación). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePlatformAdmin();
  return (
    <div className={appFont.variable}>
      <AppProviders>
        <AppShell variant="admin" account={{ username: profile.username, fullName: profile.full_name, isAdmin: true }}>
          {children}
        </AppShell>
      </AppProviders>
    </div>
  );
}
