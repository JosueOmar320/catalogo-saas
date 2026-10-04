import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { MediaLibrary } from '@/features/media/components/MediaLibrary';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Medios' };

export default async function MediaPage() {
  const ctx = await requireBusinessContext();
  return (
    <>
      <PageHeader title="Medios" description="Todas las imágenes de tu negocio en un solo lugar. Súbelas una vez y úsalas en el sitio, los productos y el PDF." />
      <MediaLibrary canManage={canManageCatalog(ctx)} />
    </>
  );
}
