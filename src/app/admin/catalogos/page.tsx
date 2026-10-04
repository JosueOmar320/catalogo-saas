import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CatalogsTable } from '@/features/admin/components/CatalogsTable';
import { listCatalogs } from '@/features/admin/queries';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Catálogos' };

export default async function AdminCatalogsPage() {
  const { supabase } = await requirePlatformAdmin();
  const catalogs = await listCatalogs(supabase);
  return (
    <>
      <PageHeader title="Catálogos" description="Un catálogo inactivo deja de publicarse aunque el negocio lo tenga publicado. Para crear uno, entra al negocio." />
      <CatalogsTable
        catalogs={catalogs.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          isActive: c.is_active,
          isDefault: c.is_default,
          updatedAt: c.updated_at,
          pages: c.pages,
          items: c.items,
          business: { id: c.business.id, name: c.business.name, slug: c.business.slug, status: c.business.status },
        }))}
      />
    </>
  );
}
