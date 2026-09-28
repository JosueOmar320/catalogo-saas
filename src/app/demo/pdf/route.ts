import { NextResponse, type NextRequest } from 'next/server';
import { renderSitePdf } from '@/features/pdf/render';
import { applyPreset, getPreset } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { PDF_TEMPLATES, pdfSettingsSchema, TEMPLATE_DEFAULTS, type PdfTemplateId } from '@/lib/pdf/settings';
import { buildSampleSite } from '@/lib/site/sample-site';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** PDF de ejemplo (sitio demo). ?template=luxury&preset=luxury. Cacheado en el CDN. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const template = (PDF_TEMPLATES as readonly string[]).includes(q.get('template') ?? '') ? (q.get('template') as PdfTemplateId) : 'classic';
  const site = buildSampleSite(q.get('preset') ? { theme: applyPreset(DEFAULT_THEME, getPreset(q.get('preset')!)) } : {});
  const about = site.pages.find((p) => p.slug === 'nosotros');
  const settings = pdfSettingsSchema.parse({
    template,
    ...TEMPLATE_DEFAULTS[template],
    content: [
      { id: 'cover', type: 'cover' },
      { id: 'catalog', type: 'catalog' },
      ...(about ? [{ id: 'about', type: 'page', pageId: about.id }] : []),
      { id: 'contact', type: 'contact' },
    ],
  });
  const pdf = await renderSitePdf(site, settings);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="catalogo-demo.pdf"',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
