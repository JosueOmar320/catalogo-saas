import { Button, Grid, Stack } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { StatCard } from '@/features/admin/components/common';
import { adminStats } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Dashboard') };
}

export default async function AdminDashboard() {
  const { supabase } = await requirePlatformAdmin();
  const [stats, t] = await Promise.all([adminStats(supabase), getT()]);
  return (
    <>
      <PageHeader
        title={t('Administración')}
        description={t('Controla quién usa la plataforma: usuarios, negocios y catálogos.')}
        actions={
          <Stack direction="row" spacing={1}>
            <Button href="/admin/negocios/nuevo" variant="outlined" startIcon={<Plus size={15} />}>{t('Nuevo negocio')}</Button>
            <Button href="/admin/usuarios/nuevo" variant="contained" startIcon={<Plus size={15} />}>{t('Nuevo usuario')}</Button>
          </Stack>
        }
      />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label={t('Usuarios activos')} value={stats.users.active} detail={t('{total} en total · {admins} admin', { total: stats.users.total, admins: stats.users.admins })} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label={t('Accesos en 7 días')} value={stats.users.recent} detail={t('Usuarios que iniciaron sesión')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label={t('Negocios activos')} value={stats.businesses.active} detail={t('{count} suspendidos', { count: stats.businesses.suspended })} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label={t('Catálogos publicados')} value={stats.catalogs.published} detail={t('{total} en total · {inactive} inactivos', { total: stats.catalogs.total, inactive: stats.catalogs.inactive })} /></Grid>
      </Grid>
      <SectionCard title={t('Actividad reciente')} action={<Button href="/admin/auditoria" size="small">{t('Ver todo')}</Button>} flush>
        <AuditTable rows={stats.audit} compact />
      </SectionCard>
    </>
  );
}
