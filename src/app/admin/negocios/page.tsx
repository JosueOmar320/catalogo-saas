import { Button } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { BusinessesTable } from '@/features/admin/components/BusinessForms';
import { listBusinesses } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Negocios') };
}

export default async function AdminBusinessesPage() {
  const { supabase } = await requirePlatformAdmin();
  const [businesses, t] = await Promise.all([listBusinesses(supabase), getT()]);
  return (
    <>
      <PageHeader
        title={t('Negocios')}
        description={t('Crea negocios y decide qué usuarios los administran.')}
        actions={<Button href="/admin/negocios/nuevo" variant="contained" startIcon={<Plus size={15} />}>{t('Nuevo negocio')}</Button>}
      />
      <BusinessesTable
        businesses={businesses.map((b) => ({ id: b.id, name: b.name, slug: b.slug, status: b.status, planId: b.plan_id, createdAt: b.created_at, owners: b.owners, members: b.members, catalogs: b.catalogs }))}
      />
    </>
  );
}
