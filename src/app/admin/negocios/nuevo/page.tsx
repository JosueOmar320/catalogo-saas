import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateBusinessForm } from '@/features/admin/components/BusinessForms';
import { listPlans } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Nuevo negocio') };
}

export default async function NewBusinessPage({ searchParams }: PageProps<'/admin/negocios/nuevo'>) {
  const { supabase } = await requirePlatformAdmin();
  const [{ owner }, { data: users }, plans, t] = await Promise.all([searchParams, supabase.from('profiles').select('*').order('username'), listPlans(supabase), getT()]);
  return (
    <>
      <PageHeader title={t('Nuevo negocio')} back={{ href: '/admin/negocios', label: t('Negocios') }} />
      <CreateBusinessForm
        // Sin cuentas de prueba («*»: antes de la migración 20261110 no existe la columna).
        users={(users ?? []).filter((u) => !(u as { demo?: boolean }).demo).map((u) => ({ id: u.id, username: u.username, fullName: u.full_name, status: u.status }))}
        plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        defaultOwner={typeof owner === 'string' ? owner : undefined}
      />
    </>
  );
}
