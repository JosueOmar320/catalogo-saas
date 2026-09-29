import type { Metadata } from 'next';
import { getSiteForAdmin } from '@/features/catalog/queries';
import { PdfStudio } from '@/features/pdf/components/PdfStudio';
import { requireBusinessContext } from '@/lib/auth/session';
import { parsePdfSettings } from '@/lib/pdf/settings';

export const metadata: Metadata = { title: 'Catálogo en PDF' };

export default async function ExportPdfPage() {
  const ctx = await requireBusinessContext();
  const site = await getSiteForAdmin(ctx);
  const legacy = (ctx.catalog.settings as { pdf?: unknown } | null)?.pdf;

  return (
    <PdfStudio
      catalogId={ctx.catalog.id}
      initial={parsePdfSettings(ctx.catalog.pdf, legacy)}
      site={site}
      enabled={ctx.entitlements.features.pdf_export}
    />
  );
}
