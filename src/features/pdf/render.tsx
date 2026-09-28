import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { PdfSettings } from '@/lib/pdf/settings';
import type { SiteViewModel } from '@/lib/site/view-model';
import { collectMediaPaths, mediaUrl } from '@/lib/utils/storage';
import { resolvePdfFonts } from './fonts';
import { prefetchImages } from './images';
import { SitePdfDocument } from './SitePdfDocument';
import { pdfTokens } from './tokens';

type Options = {
  /** Vista previa: limita la cantidad de ítems para generar rápido. */
  maxItems?: number;
};

/** Ítems que entran al PDF según el filtro del catálogo. */
function pdfItems(site: SiteViewModel, settings: PdfSettings, maxItems?: number): CatalogItemView[] {
  return maxItems ? site.items.slice(0, maxItems) : site.items;
}

/** Todas las imágenes que el PDF podría usar, para descargarlas en paralelo. */
function collectImageUrls(site: SiteViewModel, settings: PdfSettings, items: CatalogItemView[]): string[] {
  const enabled = settings.content.filter((b) => b.enabled);
  const pageIds = new Set(enabled.filter((b) => b.type === 'page').map((b) => b.pageId));
  const pages = site.pages.filter((p) => pageIds.has(p.id));
  const paths = collectMediaPaths({
    background: settings.background,
    coverBackground: settings.cover.background,
    theme: site.theme.background,
    cover: settings.cover.imageSource === 'custom' ? { path: settings.cover.imagePath } : null,
    pages: pages.map((p) => p.sections.filter((s) => s.visible)),
  });
  return [
    site.business.logoUrl,
    settings.cover.imageSource === 'cover' ? site.coverUrl : null,
    ...paths.map(mediaUrl),
    ...(settings.products.imageSize === 'none' && settings.template !== 'editorial' ? [] : items.map((i) => i.images[0]?.thumbUrl)),
  ].filter((u): u is string => Boolean(u));
}

/** Genera el PDF del sitio con la plantilla y configuración indicadas. */
export async function renderSitePdf(site: SiteViewModel, settings: PdfSettings, options: Options = {}): Promise<Buffer> {
  const items = pdfItems(site, settings, options.maxItems);
  const { typography } = site.theme;
  const [fonts, images] = await Promise.all([
    resolvePdfFonts({ heading: typography.headingFont, body: typography.bodyFont, price: typography.priceFont }),
    prefetchImages(collectImageUrls(site, settings, items)),
  ]);
  const t = pdfTokens(site.theme, settings, fonts);
  return renderToBuffer(<SitePdfDocument site={site} settings={settings} ctx={{ t, theme: site.theme, images }} items={items} />);
}
