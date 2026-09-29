import { NextResponse, type NextRequest } from 'next/server';
import { renderSitePdf } from '@/features/pdf/render';
import { applyPreset, getPreset } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { createPdfBlock, defaultPdfSettings, PDF_TEMPLATES, type PdfTemplateId } from '@/lib/pdf/settings';
import { buildSampleSite } from '@/lib/site/sample-site';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * PDF de ejemplo (sitio demo): ?template=brochure&preset=luxury.
 * Incluye portada, índice, catálogo, destacados, comparativa, galería,
 * "nosotros" y contacto. Cacheado en el CDN.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const template = (PDF_TEMPLATES as readonly string[]).includes(q.get('template') ?? '') ? (q.get('template') as PdfTemplateId) : 'catalog';
  const site = buildSampleSite(q.get('preset') ? { theme: applyPreset(DEFAULT_THEME, getPreset(q.get('preset')!)) } : {});
  const about = site.pages.find((p) => p.slug === 'nosotros');
  const base = defaultPdfSettings(template);
  const settings = {
      ...base,
      cover: { ...base.cover, eyebrow: 'Catálogo', date: 'Temporada 2026', version: 'Edición 1' },
      blocks: [
        base.blocks[0],
        base.blocks[1],
        createPdfBlock('products', template, { title: 'Lo más pedido', subtitle: 'Nuestros favoritos de la temporada.', collection: { source: 'featured', limit: 4 }, presentation: { ...base.blocks[2].type === 'catalog' ? base.blocks[2].presentation : {}, layout: template === 'menu' || template === 'minimal' ? 'priceList' : 'magazine' } }),
        base.blocks[2],
        createPdfBlock('comparison', template, { title: 'Compara nuestros cafés', collection: { source: 'category', itemType: 'product', limit: 4, categoryId: site.categories[0]?.id ?? '' } }),
        createPdfBlock('gallery', template, { title: 'Galería', collection: { source: 'all', limit: 6 }, shape: 'hexagon', columns: 3 }),
        ...(about ? [createPdfBlock('page', template, { pageId: about.id })] : []),
        createPdfBlock('contact', template, { title: 'Contáctanos', notes: '**Formas de pago:** efectivo, transferencia y tarjeta.\n\nPrecios sujetos a cambio sin previo aviso.' }),
      ],
    };
  const pdf = await renderSitePdf(site, settings);
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="catalogo-demo.pdf"',
      'X-Pdf-Pages': String(pdf.pages),
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
