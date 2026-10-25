import { Button } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { BusinessesTable } from '@/features/admin/components/BusinessForms';
import { listBusinesses, listPlans } from '@/features/admin/queries';
import { parseEntitlements } from '@/lib/plans/entitlements';
import { effectiveFeatures, featuresOff, parseFeatureOverrides, type BusinessFeature } from '@/lib/plans/features';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Negocios') };
}

export default async function AdminBusinessesPage() {
  const { supabase } = await requirePlatformAdmin();
  const [businesses, plans, t] = await Promise.all([listBusinesses(supabase), listPlans(supabase), getT()]);
  const planFeatures = new Map(plans.map((p) => [p.id, parseEntitlements(p).features]));
  const offFor = (b: (typeof businesses)[number]): BusinessFeature[] => {
    const plan = planFeatures.get(b.plan_id) ?? parseEntitlements({ id: b.plan_id, name: b.plan_id, limits: {}, features: {} }).features;
    const overrides = parseFeatureOverrides(b.feature_overrides);
    return featuresOff(effectiveFeatures(overrides, plan), overrides);
  };
  return (
    <>
      <PageHeader
        title={t('Negocios')}
        description={t('Crea negocios, decide qué usuarios los administran y qué funciones pueden usar.')}
        actions={<Button href="/admin/negocios/nuevo" variant="contained" startIcon={<Plus size={15} />}>{t('Nuevo negocio')}</Button>}
      />
      <BusinessesTable
        businesses={businesses.map((b) => ({ id: b.id, name: b.name, slug: b.slug, status: b.status, planId: b.plan_id, createdAt: b.created_at, owners: b.owners, members: b.members, catalogs: b.catalogs, featuresOff: offFor(b) }))}
      />
    </>
  );
}
