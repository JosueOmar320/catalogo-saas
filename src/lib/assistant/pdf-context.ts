import type { PdfBlock, PdfSettings } from '@/lib/pdf/settings';
import { PDF_BLOCK_META } from '@/lib/pdf/settings';
import type { PdfAssistantContext } from './context';

/** Detalle compacto de un bloque del PDF (lo que Garfield necesita para decidir). */
function blockDetails(block: PdfBlock): string {
  switch (block.type) {
    case 'catalog':
      return `layout=${block.presentation.layout} · columnas=${block.presentation.columns.pdf} · por página=${block.itemsPerPage || 'auto'} · categorías=${block.categoryStyle}${block.categoryNewPage ? ' (página nueva)' : ''} · tipo=${block.itemType}`;
    case 'products':
      return `colección=${block.collection.source} · layout=${block.presentation.layout} · columnas=${block.presentation.columns.pdf} · por página=${block.itemsPerPage || 'auto'}`;
    case 'gallery':
      return `${block.source === 'custom' ? `${block.images.length} imágenes propias` : 'fotos de ítems'} · ${block.columns} columnas · ${block.shape}`;
    case 'image':
      return `tamaño=${block.size} · ${block.imagePath ? 'con imagen' : 'sin imagen'}`;
    case 'promo':
      return `layout=${block.layout}${block.badge ? ` · etiqueta=${block.badge}` : ''}${block.imagePath ? ' · con imagen' : ''}`;
    case 'text':
      return `imagen=${block.imagePath ? block.imagePosition : 'no'}`;
    case 'comparison':
      return `colección=${block.collection.source}`;
    default:
      return '';
  }
}

export function buildPdfContext(settings: PdfSettings, selectedBlockId: string | null): PdfAssistantContext {
  const { cover, header, footer, style } = settings;
  const bg = settings.background;
  return {
    template: settings.template,
    paper: `${settings.paperSize} ${settings.orientation === 'landscape' ? 'horizontal' : 'vertical'} · márgenes ${settings.margins}`,
    selectedBlockId,
    cover: `layout=${cover.layout} · título="${cover.title || '(nombre del negocio)'}" · alineación=${cover.align} · logo=${cover.showLogo ? 'sí' : 'no'} · decoración=${cover.decoration}`.slice(0, 200),
    header: `estilo=${header.style} · logo=${header.showLogo ? header.align : 'no'} · nombre=${header.showName ? 'sí' : 'no'} · nº página=${header.showPageNumber ? 'sí' : 'no'} · título de sección=${header.showSectionTitle ? 'sí' : 'no'}`,
    footer: `estilo=${footer.style} · números=${footer.pageNumbers} · negocio=${footer.showBusinessName ? 'sí' : 'no'} · web=${footer.showWebsite ? 'sí' : 'no'} · alineación=${footer.align}`,
    style: `títulos=${style.headingFont || 'como el sitio'} · texto=${style.bodyFont || 'como el sitio'} · escala=${style.scale} · densidad=${style.density}${style.accent ? ` · acento=${style.accent}` : ''}`,
    background: bg.type === 'color' ? `color ${bg.color}` : bg.type,
    blocks: settings.blocks.slice(0, 40).map((b) => ({
      id: b.id,
      type: b.type,
      title: ('title' in b && typeof b.title === 'string' && b.title ? b.title : PDF_BLOCK_META[b.type].label).slice(0, 160),
      enabled: b.enabled,
      newPage: b.newPage,
      details: blockDetails(b).slice(0, 300),
    })),
  };
}
