import { Button } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { UsersTable } from '@/features/admin/components/UsersTable';
import { listUsers } from '@/features/admin/queries';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Usuarios' };

export default async function AdminUsersPage() {
  const { supabase } = await requirePlatformAdmin();
  const users = await listUsers(supabase);
  return (
    <>
      <PageHeader title="Usuarios" description="Sólo el administrador crea cuentas. Cada usuario entra con su nombre de usuario." actions={<Button href="/admin/usuarios/nuevo" variant="contained" startIcon={<Plus size={15} />}>Nuevo usuario</Button>} />
      <UsersTable
        users={users.map((u) => ({ id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.platform_role, status: u.status, lastLoginAt: u.last_login_at, createdAt: u.created_at, businesses: u.businesses }))}
      />
    </>
  );
}
