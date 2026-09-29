import { Document, Page, View } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { env } from '@/lib/env';
import type { PdfBlock } from '@/lib/pdf/settings';
import { Anchor, CatalogBlock, ComparisonBlock, ContactBlock, GalleryBlock, ProductsBlock, TextBlock, TocBlock, tocEntries, type TocEntry } from './blocks';
import { PdfDecorations, PdfFooter, PdfHeader } from './chrome';
import { PdfCover } from './cover';
import type { PdfDoc } from './doc';
import { PdfBackground } from './primitives';
import { PageBlock } from './sections';

function renderBlock(doc: PdfDoc, block: PdfBlock, entries: TocEntry[]): ReactElement | null {
  switch (block.type) {
    case 'toc':
      return entries.length ? <TocBlock doc={doc} block={block} entries={entries} /> : null;
    case 'catalog':
      return <CatalogBlock doc={doc} block={block} />;
    case 'products':
      return <ProductsBlock doc={doc} block={block} />;
    case 'comparison':
      return <ComparisonBlock doc={doc} block={block} />;
    case 'text':
      return <TextBlock doc={doc} block={block} />;
    case 'gallery':
      return <GalleryBlock doc={doc} block={block} />;
    case 'page':
      return <PageBlock doc={doc} block={block} />;
    case 'contact':
      return <ContactBlock doc={doc} block={block} />;
    default:
      return null;
  }
}

/**
 * Ensamblado del PDF: portada (página propia) + un flujo continuo de bloques
 * con encabezado, pie, fondo y decoración fijos. Los saltos de página los
 * deciden los bloques ("empieza en página nueva", "N ítems por página",
 * "categoría en página nueva", "salto de página"). Nunca se agrega un salto al
 * final ni un bloque vacío: así no aparecen páginas en blanco.
 */
export function SitePdfDocument({ doc }: { doc: PdfDoc }) {
  const { t, settings, site } = doc;
  const enabled = settings.blocks.filter((b) => b.enabled);
  const cover = enabled[0]?.type === 'cover' || enabled.some((b) => b.type === 'cover');
  const toc = enabled.find((b) => b.type === 'toc');
  const entries = toc && toc.type === 'toc' ? tocEntries(doc, enabled, toc.showCategories) : [];
  const pageProps = { size: settings.paperSize, orientation: settings.orientation } as const;
  const deco = settings.inkSaver ? { corners: 'none' as const, sparkles: false, frame: false } : settings.decorations;

  // Bloques del flujo, ya renderizados: los vacíos se descartan y el salto se aplica al siguiente con contenido.
  const flow: { block: PdfBlock; node: ReactElement; breakBefore: boolean }[] = [];
  let pendingBreak = false;
  for (const block of enabled) {
    if (block.type === 'cover') continue;
    if (block.type === 'pageBreak') {
      pendingBreak = true;
      continue;
    }
    const node = renderBlock(doc, block, entries);
    if (!node) continue;
    flow.push({ block, node, breakBefore: flow.length > 0 && (pendingBreak || block.newPage || flow[flow.length - 1].block.type === 'toc') });
    pendingBreak = false;
  }

  return (
    <Document title={`${site.business.name} · Catálogo`} author={site.business.name} creator={env.appName} producer={env.appName} language="es">
      {cover && (
        <Page {...pageProps} style={{ fontFamily: t.fonts.body, color: t.colors.text, backgroundColor: t.colors.paper }}>
          <PdfCover doc={doc} />
        </Page>
      )}

      {flow.length > 0 && (
        <Page
          {...pageProps}
          wrap
          style={{
            fontFamily: t.fonts.body,
            fontSize: t.size.base,
            color: t.colors.text,
            backgroundColor: t.colors.paper,
            paddingTop: t.margin + t.headerSpace,
            paddingBottom: t.margin + t.footerSpace,
            paddingHorizontal: t.margin,
          }}
        >
          <PdfBackground ctx={doc} background={t.pageBackground} width={t.pageWidth} height={t.pageHeight} fixed />
          <PdfDecorations ctx={doc} corners={deco.corners} sparkles={deco.sparkles} frame={deco.frame} color={settings.decorations.color} fixed width={t.pageWidth} height={t.pageHeight} />
          <PdfHeader doc={doc} />
          <PdfFooter doc={doc} />

          {flow.map(({ block, node, breakBefore }) => (
            <View key={block.id} break={breakBefore} style={{ marginBottom: 12 }}>
              <Anchor doc={doc} id={block.id} />
              {node}
            </View>
          ))}
        </Page>
      )}
    </Document>
  );
}
