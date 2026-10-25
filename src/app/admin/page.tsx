import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { StatCard, StatusChip } from '@/features/admin/components/common';
import { adminStats, listBusinesses, listPlans } from '@/features/admin/queries';
import { parseEntitlements } from '@/lib/plans/entitlements';
import { BUSINESS_FEATURE_META, BUSINESS_FEATURES, effectiveFeatures, parseFeatureOverrides } from '@/lib/plans/features';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Dashboard') };
}

export default async function AdminDashboard() {
  const { supabase } = await requirePlatformAdmin();
  const [stats, businesses, plans, t] = await Promise.all([adminStats(supabase), listBusinesses(supabase), listPlans(supabase), getT()]);
  const planFeatures = new Map(plans.map((p) => [p.id, parseEntitlements(p).features]));
  const recent = businesses.slice(0, 6).map((b) => {
    const effective = effectiveFeatures(parseFeatureOverrides(b.feature_overrides), planFeatures.get(b.plan_id) ?? parseEntitlements({ id: b.plan_id, name: b.plan_id, limits: {}, features: {} }).features);
    return { ...b, off: BUSINESS_FEATURES.filter((f) => !effective[f]) };
  });
  return (
    <>
      <PageHeader
        title={t('Administración')}
        description={t('Controla quién usa la plataforma: usuarios, negocios, catálogos y qué funciones puede usar cada negocio.')}
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
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title={t('Negocios recientes')} action={<Button href="/admin/negocios" size="small">{t('Ver todos')}</Button>} flush>
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
              {recent.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>{t('Todavía no hay negocios.')}</Typography>}
              {recent.map((b) => (
                <Box key={b.id} component="a" href={`/admin/negocios/${b.id}`} sx={{ display: 'block', px: 2.5, py: 1.5, color: 'inherit', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover' } }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap>{b.name}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="p">/{b.slug}{b.owners[0] ? ` · @${b.owners[0].username}` : ''}</Typography>
                    </Box>
                    <StatusChip status={b.status} />
                  </Stack>
                  {b.off.length > 0 && (
                    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                      {b.off.map((f) => <Chip key={f} size="small" color="warning" variant="outlined" label={t('Sin {feature}', { feature: t(BUSINESS_FEATURE_META[f].label) })} />)}
                    </Stack>
                  )}
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title={t('Actividad reciente')} action={<Button href="/admin/auditoria" size="small">{t('Ver todo')}</Button>} flush>
            <AuditTable rows={stats.audit} compact />
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
