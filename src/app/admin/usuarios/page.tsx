import { Button } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { UsersTable } from '@/features/admin/components/UsersTable';
import { listUsers } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Usuarios') };
}

export default async function AdminUsersPage() {
  const { supabase } = await requirePlatformAdmin();
  const [users, t] = await Promise.all([listUsers(supabase), getT()]);
  return (
    <>
      <PageHeader
        title={t('Usuarios')}
        description={t('Sólo el administrador crea cuentas. Cada usuario entra con su nombre de usuario.')}
        actions={<Button href="/admin/usuarios/nuevo" variant="contained" startIcon={<Plus size={15} />}>{t('Nuevo usuario')}</Button>}
      />
      <UsersTable
        users={users.map((u) => ({ id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.platform_role, status: u.status, lastLoginAt: u.last_login_at, createdAt: u.created_at, businesses: u.businesses }))}
      />
    </>
  );
}
