import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { EditUserPanel } from '@/features/admin/components/UserForms';
import { getUserDetail, listAudit } from '@/features/admin/queries';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';
import { uuidSchema } from '@/lib/utils/validation';

export const metadata: Metadata = { title: 'Usuario' };

export default async function UserDetailPage({ params }: PageProps<'/admin/usuarios/[userId]'>) {
  const { userId } = await params;
  if (!uuidSchema.safeParse(userId).success) notFound();
  const { supabase, userId: me } = await requirePlatformAdmin();
  const [user, { data: businesses }, audit] = await Promise.all([
    getUserDetail(supabase, userId),
    supabase.from('businesses').select('id, name').is('deleted_at', null).order('name'),
    listAudit(supabase, { limit: 15 }),
  ]);
  if (!user) notFound();
  const related = audit.rows.filter((r) => r.entity_id === userId || r.actor_id === userId || r.entity_id?.endsWith(`:${userId}`));
  return (
    <>
      <PageHeader title={`@${user.username}`} description={user.full_name || undefined} back={{ href: '/admin/usuarios', label: 'Usuarios' }} />
      <EditUserPanel
        user={{
          id: user.id,
          username: user.username,
          fullName: user.full_name ?? '',
          email: user.email ?? '',
          role: user.platform_role,
          status: user.status,
          maxBusinesses: user.max_businesses,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at,
          businesses: user.businesses,
        }}
        businesses={businesses ?? []}
        isSelf={user.id === me}
        serviceRoleReady={isServiceRoleConfigured()}
      />
      {related.length > 0 && (
        <SectionCard title="Actividad reciente" sx={{ mt: 2.5 }} flush>
          <AuditTable rows={related} compact />
        </SectionCard>
      )}
    </>
  );
}
