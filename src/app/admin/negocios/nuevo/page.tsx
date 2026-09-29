import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateBusinessForm } from '@/features/admin/components/BusinessForms';
import { listPlans } from '@/features/admin/queries';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Nuevo negocio' };

export default async function NewBusinessPage({ searchParams }: PageProps<'/admin/negocios/nuevo'>) {
  const { supabase } = await requirePlatformAdmin();
  const [{ owner }, { data: users }, plans] = await Promise.all([searchParams, supabase.from('profiles').select('id, username, full_name, status').order('username'), listPlans(supabase)]);
  return (
    <>
      <PageHeader title="Nuevo negocio" back={{ href: '/admin/negocios', label: 'Negocios' }} />
      <CreateBusinessForm
        users={(users ?? []).map((u) => ({ id: u.id, username: u.username, fullName: u.full_name, status: u.status }))}
        plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        defaultOwner={typeof owner === 'string' ? owner : undefined}
      />
    </>
  );
}
