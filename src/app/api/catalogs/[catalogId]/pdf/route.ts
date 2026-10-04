import { NextResponse, type NextRequest } from 'next/server';
import { getSiteForAdmin } from '@/features/catalog/queries';
import { renderSitePdf } from '@/features/pdf/render';
import { getBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { parsePdfSettings, pdfSettingsSchema, type PdfSettings } from '@/lib/pdf/settings';
import { collectMediaPaths } from '@/lib/utils/storage';
import { invalidMediaRefs } from '@/features/media/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Catálogos grandes: react-pdf + descarga de imágenes puede tardar varios segundos.
export const maxDuration = 60;

const PREVIEW_MAX_ITEMS = 60;

async function authorize(catalogId: string): Promise<BusinessContext | NextResponse> {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // El catálogo debe pertenecer al negocio resuelto en el servidor.
  if (ctx.catalog.id !== catalogId) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (!ctx.entitlements.features.pdf_export) {
    return NextResponse.json({ error: 'La exportación a PDF no está incluida en tu plan.' }, { status: 403 });
  }
  return ctx;
}

async function respond(ctx: BusinessContext, settings: PdfSettings, { download, preview }: { download: boolean; preview: boolean }) {
  // El servidor descarga las imágenes: sólo archivos del negocio o URLs externas de su biblioteca (y éstas, con descarga segura).
  if ((await invalidMediaRefs(ctx, collectMediaPaths(settings))).length > 0) {
    return NextResponse.json({ error: 'Imagen inválida en la configuración.' }, { status: 400 });
  }
  const site = await getSiteForAdmin(ctx);
  const pdf = await renderSitePdf(site, settings, { maxItems: preview ? PREVIEW_MAX_ITEMS : undefined });
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'X-Pdf-Pages': String(pdf.pages),
      'X-Pdf-Marks': JSON.stringify(pdf.marks),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${ctx.business.slug}-catalogo.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/** Descarga con la configuración guardada. */
export async function GET(request: NextRequest, { params }: RouteContext<'/api/catalogs/[catalogId]/pdf'>) {
  const { catalogId } = await params;
  const ctx = await authorize(catalogId);
  if (ctx instanceof NextResponse) return ctx;
  const legacy = (ctx.catalog.settings as { pdf?: unknown } | null)?.pdf;
  const settings = parsePdfSettings(ctx.catalog.pdf, legacy);
  return respond(ctx, settings, { download: request.nextUrl.searchParams.get('download') === '1', preview: false });
}

/** Vista previa / descarga con una configuración en borrador (sin guardarla). */
export async function POST(request: NextRequest, { params }: RouteContext<'/api/catalogs/[catalogId]/pdf'>) {
  const { catalogId } = await params;
  const ctx = await authorize(catalogId);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { settings?: unknown; preview?: boolean } | null;
  const parsed = pdfSettingsSchema.safeParse(body?.settings);
  if (!parsed.success) return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 });
  return respond(ctx, parsed.data, { download: !body?.preview, preview: Boolean(body?.preview) });
}
