import { Document, Page, View } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { env } from '@/lib/env';
import type { PdfBlock } from '@/lib/pdf/settings';
import { Anchor, CatalogBlock, ComparisonBlock, ContactBlock, GalleryBlock, ProductsBlock, TextBlock, TocBlock, tocEntries, type TocEntry } from './blocks';
import { PdfDecorations, PdfFooter, PdfHeader } from './chrome';
import { PdfCover } from './cover';
import type { PdfDoc } from './doc';
import { PdfBackground } from './primitives';
import { BackCoverBlock, ImagePageBlock, isStandalonePage, PromoPageBlock } from './pages';
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
    case 'image':
      return block.imagePath ? <ImagePageBlock doc={doc} block={block} standalone={block.size === 'full'} /> : null;
    case 'promo':
      return <PromoPageBlock doc={doc} block={block} />;
    case 'backCover':
      return <BackCoverBlock doc={doc} block={block} />;
    case 'cover':
    case 'pageBreak':
      return null;
  }
}

type FlowItem = { block: PdfBlock; node: ReactElement; breakBefore: boolean };
type Segment = { kind: 'flow'; items: FlowItem[] } | { kind: 'page'; block: PdfBlock; node: ReactElement };

/**
 * Ensamblado del PDF: portada (página propia) y luego, en orden, tramos de
 * FLUJO (bloques continuos con encabezado, pie, fondo y decoración fijos) y
 * páginas ENTERAS de diseño (imagen a sangre, promocional, contraportada) con
 * su propio fondo. Los saltos los deciden los bloques ("empieza en página
 * nueva", "N ítems por página", "salto de página"). Nunca se agrega un salto
 * al final ni un bloque vacío: así no aparecen páginas en blanco.
 */
export function SitePdfDocument({ doc }: { doc: PdfDoc }) {
  const { t, settings, site } = doc;
  const enabled = settings.blocks.filter((b) => b.enabled);
  const cover = enabled[0]?.type === 'cover' || enabled.some((b) => b.type === 'cover');
  const toc = enabled.find((b) => b.type === 'toc');
  const entries = toc && toc.type === 'toc' ? tocEntries(doc, enabled, toc.showCategories) : [];
  const pageProps = { size: settings.paperSize, orientation: settings.orientation } as const;
  const deco = settings.inkSaver ? { corners: 'none' as const, sparkles: false, frame: false } : settings.decorations;

  // Tramos ya renderizados: los bloques vacíos se descartan y el salto se aplica al siguiente con contenido.
  const segments: Segment[] = [];
  let pendingBreak = false;
  for (const block of enabled) {
    if (block.type === 'cover') continue;
    if (block.type === 'pageBreak') {
      pendingBreak = true;
      continue;
    }
    const node = renderBlock(doc, block, entries);
    if (!node) continue;
    if (isStandalonePage(block)) {
      segments.push({ kind: 'page', block, node });
      pendingBreak = false;
      continue;
    }
    const last = segments[segments.length - 1];
    const flow = last?.kind === 'flow' ? last : (segments.push({ kind: 'flow', items: [] }), segments[segments.length - 1] as Extract<Segment, { kind: 'flow' }>);
    const previous = flow.items[flow.items.length - 1];
    flow.items.push({ block, node, breakBefore: Boolean(previous) && (pendingBreak || block.newPage || previous.block.type === 'toc') });
    pendingBreak = false;
  }
  const flowStyle = {
    fontFamily: t.fonts.body,
    fontSize: t.size.base,
    color: t.colors.text,
    backgroundColor: t.colors.paper,
    paddingTop: t.margin + t.headerSpace,
    paddingBottom: t.margin + t.footerSpace,
    paddingHorizontal: t.margin,
  };

  return (
    <Document title={`${site.business.name} · Catálogo`} author={site.business.name} creator={env.appName} producer={env.appName} language="es">
      {cover && (
        <Page {...pageProps} style={{ fontFamily: t.fonts.body, color: t.colors.text, backgroundColor: t.colors.paper }}>
          <PdfCover doc={doc} />
        </Page>
      )}

      {segments.map((segment, index) =>
        segment.kind === 'page' ? (
          // Página entera de diseño: nunca se parte (sin wrap) y el ancla no ocupa lugar.
          <Page key={segment.block.id} {...pageProps} wrap={false} style={{ fontFamily: t.fonts.body, color: t.colors.text, backgroundColor: t.colors.paper }}>
            <View style={{ position: 'absolute', top: 0, left: 0 }}>
              <Anchor doc={doc} id={segment.block.id} />
            </View>
            {segment.node}
          </Page>
        ) : (
          <Page key={`flow-${index}`} {...pageProps} wrap style={flowStyle}>
            <PdfBackground ctx={doc} background={t.pageBackground} width={t.pageWidth} height={t.pageHeight} fixed />
            <PdfDecorations ctx={doc} corners={deco.corners} sparkles={deco.sparkles} frame={deco.frame} color={settings.decorations.color} fixed width={t.pageWidth} height={t.pageHeight} />
            <PdfHeader doc={doc} />
            <PdfFooter doc={doc} />
            {segment.items.map(({ block, node, breakBefore }) => (
              <View key={block.id} break={breakBefore} style={{ marginBottom: 12 * t.density }}>
                <Anchor doc={doc} id={block.id} />
                {node}
              </View>
            ))}
          </Page>
        ),
      )}
    </Document>
  );
}
