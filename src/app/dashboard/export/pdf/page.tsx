import type { Metadata } from 'next';
import { listItemsWithImages, listPages } from '@/features/catalog/queries';
import { PdfStudio } from '@/features/pdf/components/PdfStudio';
import { requireBusinessContext } from '@/lib/auth/session';
import { parsePdfSettings } from '@/lib/pdf/settings';

export const metadata: Metadata = { title: 'Catálogo en PDF' };

export default async function ExportPdfPage() {
  const ctx = await requireBusinessContext();
  const [items, pages] = await Promise.all([listItemsWithImages(ctx), listPages(ctx)]);
  const legacy = (ctx.catalog.settings as { pdf?: unknown } | null)?.pdf;

  return (
    <PdfStudio
      catalogId={ctx.catalog.id}
      initial={parsePdfSettings(ctx.catalog.pdf, legacy)}
      pages={pages.map((p) => ({ id: p.id, title: p.title }))}
      enabled={ctx.entitlements.features.pdf_export}
      itemCount={items.filter((i) => i.is_visible).length}
    />
  );
}
