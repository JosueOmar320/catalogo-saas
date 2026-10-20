import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/env';
import { looksPersonal } from '@/lib/catalog/search-misses';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * El buscador del sitio publicado avisa que una búsqueda no encontró nada
 * (sólo el término). Se cuenta por negocio y día para que el negocio sepa qué
 * le piden y no tiene. La validación de fondo (negocio publicado, tope por
 * día) la hace record_search_miss en la base; aquí se filtra la forma, el
 * origen, los robots, el ritmo y lo que parece un dato personal.
 *
 * Responde 204 aunque no cuente.
 */
const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  term: z.string().trim().min(3).max(60),
});

const MAX_BYTES = 500;
// Por IP y negocio: unas cuantas búsquedas fallidas por hora es normal.
const LIMIT = 30;
const WINDOW_SECONDS = 3600;
const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse/i;

const noContent = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) return new NextResponse(null, { status: 413 });

  let body: z.output<typeof bodySchema>;
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
    body = bodySchema.parse(JSON.parse(text));
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (BOTS.test(request.headers.get('user-agent') ?? '') || looksPersonal(body.term)) return noContent();
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return noContent();
  if (!(await consumeRateLimit(`search-miss:${await clientIp()}:${body.slug}`, LIMIT, WINDOW_SECONDS))) {
    return new NextResponse(null, { status: 429 });
  }

  const { error } = await createAdminClient().rpc('record_search_miss', { p_business_slug: body.slug, p_term: body.term });
  if (error) console.error('[search-misses] no se pudo registrar la búsqueda', { code: error.code });
  return noContent();
}
