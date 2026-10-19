import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { MediaGrid } from '@/features/admin/components/MediaGrid';
import { listMedia } from '@/features/admin/queries';
import { getT } from '@/i18n/server';
import { requirePlatformAdmin } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Medios') };
}

export default async function AdminMediaPage() {
  const { supabase } = await requirePlatformAdmin();
  const [media, t] = await Promise.all([listMedia(supabase, { limit: 120 }), getT()]);
  return (
    <>
      <PageHeader title={t('Medios')} description={t('Imágenes subidas o importadas por los negocios (las más recientes).')} />
      <MediaGrid items={media.map((m) => ({ id: m.id, url: m.url, alt: m.alt, businessName: m.businessName, source: m.source, createdAt: m.created_at, width: m.width, height: m.height }))} />
    </>
  );
}
