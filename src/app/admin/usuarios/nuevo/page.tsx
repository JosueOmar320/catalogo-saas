import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateUserForm } from '@/features/admin/components/UserForms';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Nuevo usuario' };

export default async function NewUserPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data: businesses } = await supabase.from('businesses').select('id, name').is('deleted_at', null).order('name');
  return (
    <>
      <PageHeader title="Nuevo usuario" back={{ href: '/admin/usuarios', label: 'Usuarios' }} />
      <CreateUserForm businesses={businesses ?? []} serviceRoleReady={isServiceRoleConfigured()} />
    </>
  );
}
