import { Button, Grid, Stack } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { StatCard } from '@/features/admin/components/common';
import { adminStats } from '@/features/admin/queries';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function AdminDashboard() {
  const { supabase } = await requirePlatformAdmin();
  const stats = await adminStats(supabase);
  return (
    <>
      <PageHeader
        title="Administración"
        description="Controla quién usa la plataforma: usuarios, negocios y catálogos."
        actions={
          <Stack direction="row" spacing={1}>
            <Button href="/admin/negocios/nuevo" variant="outlined" startIcon={<Plus size={15} />}>Nuevo negocio</Button>
            <Button href="/admin/usuarios/nuevo" variant="contained" startIcon={<Plus size={15} />}>Nuevo usuario</Button>
          </Stack>
        }
      />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Usuarios activos" value={stats.users.active} detail={`${stats.users.total} en total · ${stats.users.admins} admin`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Accesos en 7 días" value={stats.users.recent} detail="Usuarios que iniciaron sesión" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Negocios activos" value={stats.businesses.active} detail={`${stats.businesses.suspended} suspendidos`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Catálogos publicados" value={stats.catalogs.published} detail={`${stats.catalogs.total} en total · ${stats.catalogs.inactive} inactivos`} /></Grid>
      </Grid>
      <SectionCard title="Actividad reciente" action={<Button href="/admin/auditoria" size="small">Ver todo</Button>} flush>
        <AuditTable rows={stats.audit} compact />
      </SectionCard>
    </>
  );
}
