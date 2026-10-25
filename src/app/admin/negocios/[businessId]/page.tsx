import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { EditBusinessPanel } from '@/features/admin/components/BusinessForms';
import { getBusinessDetail, listAudit, listPlans } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { uuidSchema } from '@/lib/utils/validation';
import { parseEntitlements } from '@/lib/plans/entitlements';
import { parseSiteKind } from '@/lib/business/site-kind';
import { BUSINESS_FEATURES, parseFeatureOverrides, planFeatureDefault, type BusinessFeatures } from '@/lib/plans/features';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Negocio') };
}

export default async function BusinessDetailPage({ params }: PageProps<'/admin/negocios/[businessId]'>) {
  const { businessId } = await params;
  if (!uuidSchema.safeParse(businessId).success) notFound();
  const { supabase } = await requirePlatformAdmin();
  const [detail, plans, audit, t] = await Promise.all([getBusinessDetail(supabase, businessId), listPlans(supabase), listAudit(supabase, { limit: 200 }), getT()]);
  if (!detail) notFound();
  const { business } = detail;
  const planRow = plans.find((p) => p.id === business.plan_id);
  const planFeatures = parseEntitlements(planRow ?? { id: business.plan_id, name: business.plan_id, limits: {}, features: {} }).features;
  return (
    <>
      <PageHeader title={business.name} description={`/${business.slug}`} back={{ href: '/admin/negocios', label: t('Negocios') }} />
      <EditBusinessPanel
        business={{
          id: business.id,
          name: business.name,
          slug: business.slug,
          planId: business.plan_id,
          status: business.status,
          createdAt: business.created_at,
          members: detail.members,
          catalogs: detail.catalogs.map((c) => ({ id: c.id, name: c.name, status: c.status, isActive: c.is_active, isDefault: c.is_default, updatedAt: c.updated_at })),
          customCode: business.custom_code ?? null,
          siteKind: parseSiteKind(business.site_kind),
          featureOverrides: parseFeatureOverrides(business.feature_overrides),
          totals: detail.totals,
        }}
        users={detail.users}
        plans={plans.map((p) => ({ id: p.id, name: p.name, customCode: parseEntitlements(p).features.custom_code }))}
        planDefaults={Object.fromEntries(BUSINESS_FEATURES.map((f) => [f, planFeatureDefault(f, planFeatures)])) as BusinessFeatures}
        activity={
          <SectionCard title={t('Actividad del negocio')} description={t('Los últimos cambios de sus usuarios y de los administradores.')} flush>
            <AuditTable rows={audit.rows.filter((r) => r.business_id === business.id).slice(0, 50)} compact hideBusiness />
          </SectionCard>
        }
      />
    </>
  );
}
