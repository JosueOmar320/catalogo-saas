import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { resolveCollection } from '@/lib/catalog/collections';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { PdfSettings } from '@/lib/pdf/settings';
import type { SiteViewModel } from '@/lib/site/view-model';
import { collectMediaPaths, mediaUrl } from '@/lib/utils/storage';
import { PDF_SKINS, type PdfDoc } from './doc';
import { resolvePdfFonts } from './fonts';
import { prefetchImages } from './images';
import { parseVideoUrl } from '@/lib/site/video';
import { BIG_IMAGE_LAYOUTS } from './products';
import { tocEntries } from './blocks';
import { FONT_IDS, type FontId } from '@/lib/design/fonts';
import { SitePdfDocument } from './SitePdfDocument';
import { pdfTokens } from './tokens';

type Options = {
  /** Vista previa: limita la cantidad de ítems para generar rápido. */
  maxItems?: number;
};

/** `marks`: página donde empieza cada bloque / categoría (la vista previa salta a ella). */
export type RenderedPdf = { buffer: Buffer; pages: number; marks: Record<string, number> };

/** Imágenes que el PDF usará, para descargarlas en paralelo (miniatura o foto completa según el layout). */
function collectImageUrls(site: SiteViewModel, settings: PdfSettings, items: CatalogItemView[]): string[] {
  const blocks = settings.blocks.filter((b) => b.enabled);
  const pageIds = new Set(blocks.flatMap((b) => (b.type === 'page' ? [b.pageId] : [])));
  const pages = site.pages.filter((p) => pageIds.has(p.id));
  const sections = pages.flatMap((p) => p.sections.filter((s) => s.visible));
  const layouts = [
    ...blocks.flatMap((b) => (b.type === 'catalog' || b.type === 'products' ? [b.presentation] : [])),
    ...sections.flatMap((s) => (s.type === 'products' || s.type === 'services' || s.type === 'catalog' ? [s.content.presentation] : [])),
  ];
  const big = layouts.some((p) => BIG_IMAGE_LAYOUTS.has(p.layout));
  const gallery = layouts.some((p) => p.layout === 'detail' && p.gallery);
  const galleryItems = blocks.flatMap((b) => (b.type === 'gallery' && b.source === 'items' ? resolveCollection(b.collection, items).map((i) => i.images[0]?.url) : []));
  const paths = collectMediaPaths({ background: settings.background, cover: settings.cover, theme: site.theme.background, blocks, sections });
  // Miniatura de YouTube (host fijo) para las secciones de video.
  const videoThumbs = sections.flatMap((s) => {
    const video = s.type === 'video' && s.content.url ? parseVideoUrl(s.content.url) : null;
    return video?.kind === 'youtube' ? [video.thumbnail] : [];
  });
  const heroCategories = blocks.some((b) => b.type === 'catalog' && (b.categoryStyle === 'hero' || b.categoryStyle === 'image'));
  return [
    site.business.logoUrl,
    settings.cover.imageSource === 'cover' ? site.coverUrl : null,
    ...paths.map(mediaUrl),
    ...galleryItems,
    ...videoThumbs,
    ...(heroCategories ? site.categories.map((c) => c.imageUrl) : []),
    ...items.flatMap((i) => [i.images[0]?.thumbUrl, big ? i.images[0]?.url : null, ...(gallery ? i.images.slice(1, 4).map((x) => x.thumbUrl) : [])]),
  ].filter((u): u is string => Boolean(u));
}

/** Páginas de un PDF generado por react-pdf (pdfkit escribe los diccionarios sin comprimir). */
function countPages(buffer: Buffer): number {
  return buffer.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
}

/**
 * Genera el PDF del sitio. Con índice, se renderiza dos veces: la primera
 * pasada registra en qué página cae cada sección y la segunda escribe esos
 * números en el índice (el índice ocupa lo mismo en ambas pasadas).
 */
export async function renderSitePdf(site: SiteViewModel, settings: PdfSettings, options: Options = {}): Promise<RenderedPdf> {
  const items = options.maxItems ? site.items.slice(0, options.maxItems) : site.items;
  const { typography } = site.theme;
  // Fuentes propias del PDF (si se eligieron); si no, las del sitio.
  const font = (id: string, fallback: FontId): FontId => ((FONT_IDS as readonly string[]).includes(id) ? (id as FontId) : fallback);
  const [fonts, images] = await Promise.all([
    resolvePdfFonts({ heading: font(settings.style.headingFont, typography.headingFont), body: font(settings.style.bodyFont, typography.bodyFont), price: font(settings.style.bodyFont, typography.priceFont) }),
    prefetchImages(collectImageUrls(site, settings, items)),
  ]);
  const t = pdfTokens(site.theme, settings, fonts);
  const doc: PdfDoc = {
    t,
    theme: site.theme,
    images,
    site: { ...site, items },
    settings,
    skin: PDF_SKINS[settings.template],
    categoryNames: new Map(site.categories.map((c) => [c.id, c.name])),
    items,
    marks: new Map(),
    toc: new Map(),
    sectionTitles: new Map(),
  };
  doc.sectionTitles = new Map(tocEntries(doc, settings.blocks.filter((b) => b.enabled), true).map((e) => [e.id, e.label]));

  // Segunda pasada si hace falta saber en qué página cae cada bloque (índice o título de sección en el encabezado).
  const twoPasses = settings.blocks.some((b) => b.enabled && b.type === 'toc') || (settings.header.style !== 'none' && settings.header.showSectionTitle);
  let final = doc;
  let buffer = await renderToBuffer(<SitePdfDocument doc={doc} />);
  if (twoPasses) {
    final = { ...doc, toc: new Map(doc.marks), marks: new Map() };
    buffer = await renderToBuffer(<SitePdfDocument doc={final} />);
  }
  return { buffer, pages: countPages(buffer), marks: Object.fromEntries(final.marks) };
}
