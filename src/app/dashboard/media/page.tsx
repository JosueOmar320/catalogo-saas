import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { MediaLibrary } from '@/features/media/components/MediaLibrary';
import { canManageCatalog, requireBusinessContext } from '@/lib/auth/session';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Medios') };
}

export default async function MediaPage() {
  const ctx = await requireBusinessContext();
  const t = await getT();
  return (
    <>
      <PageHeader title={t('Medios')} description={t('Todas las imágenes de tu negocio en un solo lugar. Súbelas una vez y úsalas en el sitio, los productos y el PDF.')} />
      <MediaLibrary canManage={canManageCatalog(ctx)} />
    </>
  );
}
