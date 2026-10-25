import { NextResponse, type NextRequest } from 'next/server';
import { getSiteForAdmin } from '@/features/catalog/queries';
import { renderSitePdf } from '@/features/pdf/render';
import { getT } from '@/i18n/server';
import { getBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { parsePdfSettings, pdfSettingsSchema, type PdfSettings } from '@/lib/pdf/settings';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { collectMediaPaths } from '@/lib/utils/storage';
import { invalidMediaRefs } from '@/features/media/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Catálogos grandes: react-pdf + descarga de imágenes puede tardar varios segundos.
export const maxDuration = 60;

const PREVIEW_MAX_ITEMS = 60;
/** Configuración en borrador (POST): más que esto no es una configuración. */
const MAX_BODY_BYTES = 256 * 1024;
/** PDFs por persona cada 10 minutos (cada uno tarda segundos de CPU). */
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 600;
/** Ids de bloque que van en la cabecera X-Pdf-Marks (vienen del cliente: sólo ASCII, o la cabecera no se puede escribir). */
const MARK_ID = /^[A-Za-z0-9_-]{1,64}$/;

async function authorize(catalogId: string): Promise<BusinessContext | NextResponse> {
  const t = await getT();
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: t('No autorizado') }, { status: 401 });
  // El catálogo debe pertenecer al negocio resuelto en el servidor; un sitio web sin catálogo no tiene PDF.
  if (ctx.catalog.id !== catalogId || ctx.siteKind !== 'catalog') return NextResponse.json({ error: t('No encontrado') }, { status: 404 });
  if (!ctx.features.pdf_export) {
    return NextResponse.json({ error: t('La exportación a PDF no está incluida en tu plan.') }, { status: 403 });
  }
  if (!(await consumeRateLimit(`pdf:${ctx.userId}`, RATE_LIMIT, RATE_WINDOW_SECONDS))) {
    return NextResponse.json({ error: t('Demasiadas solicitudes. Intenta de nuevo en unos minutos.') }, { status: 429 });
  }
  return ctx;
}

async function respond(ctx: BusinessContext, settings: PdfSettings, { download, preview }: { download: boolean; preview: boolean }) {
  // El servidor descarga las imágenes: sólo archivos del negocio o URLs externas de su biblioteca (y éstas, con descarga segura).
  if ((await invalidMediaRefs(ctx, collectMediaPaths(settings))).length > 0) {
    const t = await getT();
    return NextResponse.json({ error: t('Imagen inválida en la configuración.') }, { status: 400 });
  }
  // Como el sitio publicado: sin los productos fuera de temporada.
  const site = await getSiteForAdmin(ctx, { inSeasonOnly: true });
  const pdf = await renderSitePdf(site, settings, { maxItems: preview ? PREVIEW_MAX_ITEMS : undefined });
  const marks = Object.fromEntries(Object.entries(pdf.marks).filter(([id]) => MARK_ID.test(id)));
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'X-Pdf-Pages': String(pdf.pages),
      'X-Pdf-Marks': JSON.stringify(marks),
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
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  type Body = { settings?: unknown; preview?: boolean } | null;
  let body: Body = null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
    body = JSON.parse(text) as Body;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = pdfSettingsSchema.safeParse(body?.settings);
  if (!parsed.success) {
    const t = await getT();
    return NextResponse.json({ error: t('Configuración inválida') }, { status: 400 });
  }
  return respond(ctx, parsed.data, { download: !body?.preview, preview: Boolean(body?.preview) });
}
