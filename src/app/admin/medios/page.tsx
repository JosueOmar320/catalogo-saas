import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { MediaGrid } from '@/features/admin/components/MediaGrid';
import { listMedia } from '@/features/admin/queries';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Medios' };

export default async function AdminMediaPage() {
  const { supabase } = await requirePlatformAdmin();
  const media = await listMedia(supabase, { limit: 120 });
  return (
    <>
      <PageHeader title="Medios" description="Imágenes subidas o importadas por los negocios (las más recientes)." />
      <MediaGrid items={media.map((m) => ({ id: m.id, url: m.url, alt: m.alt, businessName: m.businessName, source: m.source, createdAt: m.created_at, width: m.width, height: m.height }))} />
    </>
  );
}
