import type { Metadata } from 'next';
import { getSiteForAdmin } from '@/features/catalog/queries';
import { PdfStudio } from '@/features/pdf/components/PdfStudio';
import { getT } from '@/i18n/server';
import { canManageCatalog, requireCatalogFeature } from '@/lib/auth/session';
import { parsePdfSettings } from '@/lib/pdf/settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Catálogo en PDF') };
}

export default async function ExportPdfPage() {
  const ctx = await requireCatalogFeature('pdf_export');
  const site = await getSiteForAdmin(ctx);
  const legacy = (ctx.catalog.settings as { pdf?: unknown } | null)?.pdf;

  return (
    <PdfStudio
      catalogId={ctx.catalog.id}
      initial={parsePdfSettings(ctx.catalog.pdf, legacy)}
      site={site}
      enabled={ctx.features.pdf_export}
      canManage={canManageCatalog(ctx)}
    />
  );
}
