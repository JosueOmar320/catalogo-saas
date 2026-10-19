import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateUserForm } from '@/features/admin/components/UserForms';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Nuevo usuario') };
}

export default async function NewUserPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: businesses }, t] = await Promise.all([supabase.from('businesses').select('id, name').is('deleted_at', null).order('name'), getT()]);
  return (
    <>
      <PageHeader title={t('Nuevo usuario')} back={{ href: '/admin/usuarios', label: t('Usuarios') }} />
      <CreateUserForm businesses={businesses ?? []} serviceRoleReady={isServiceRoleConfigured()} />
    </>
  );
}
