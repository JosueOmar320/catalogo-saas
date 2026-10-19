import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/env';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Un visitante deja una reseña desde el sitio publicado. Entra pendiente: el
 * negocio la aprueba en el panel antes de que se publique. La validación de
 * fondo (negocio publicado con reseñas activas, producto visible de ese
 * catálogo) la hace submit_review en la base; aquí se filtra la forma, el
 * origen, el campo trampa para robots y el ritmo.
 */
const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  item: z.string().regex(/^[a-z0-9-]{1,120}$/).nullable().default(null),
  name: z.string().trim().min(1).max(60),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(600).default(''),
  /** Campo trampa: invisible para las personas; si viene lleno, es un robot. */
  website: z.string().max(200).optional(),
});

const MAX_BYTES = 4_000;
// Por IP y negocio: nadie deja 5 reseñas reales en una hora.
const LIMIT = 5;
const WINDOW_SECONDS = 3600;

const json = (ok: boolean, status = 200) => NextResponse.json({ ok }, { status, headers: { 'Cache-Control': 'no-store' } });

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

  // El robot cree que funcionó; no se guarda nada.
  if (body.website) return json(true);
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return json(false, 503);
  if (!(await consumeRateLimit(`review:${await clientIp()}:${body.slug}`, LIMIT, WINDOW_SECONDS))) return json(false, 429);

  const { data, error } = await createAdminClient().rpc('submit_review', {
    p_business_slug: body.slug,
    p_item_slug: body.item,
    p_name: body.name,
    p_rating: body.rating,
    p_body: body.body,
  });
  if (error) {
    console.error('[reviews] no se pudo guardar la reseña', { code: error.code });
    return json(false, 500);
  }
  return json(Boolean(data));
}
