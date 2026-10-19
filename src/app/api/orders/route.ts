import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/env';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * El sitio público avisa que un visitante envió su pedido por WhatsApp
 * (navigator.sendBeacon). Sólo se cuentan pedidos y productos: no llega ni se
 * guarda nada del visitante. La validación de fondo (negocio publicado, pedidos
 * activos, productos disponibles de ese catálogo, precios) la hace record_order
 * en la base; aquí se filtra la forma, el origen y el ritmo.
 *
 * Responde 204 aunque el pedido no cuente: el visitante no espera respuesta y
 * así tampoco sirve para averiguar qué negocios o productos existen.
 */
const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  items: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(99) })).min(1).max(50),
});

const MAX_BYTES = 8_000;
// Por IP y negocio: un visitante real no envía 20 pedidos en una hora.
const LIMIT = 20;
const WINDOW_SECONDS = 3600;

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

  // Sin base (recién clonado, demo) no hay dónde contar.
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return noContent();
  if (!(await consumeRateLimit(`order:${await clientIp()}:${body.slug}`, LIMIT, WINDOW_SECONDS))) {
    return new NextResponse(null, { status: 429 });
  }

  const { error } = await createAdminClient().rpc('record_order', { p_business_slug: body.slug, p_items: body.items });
  if (error) console.error('[orders] no se pudo registrar el pedido', { code: error.code });
  return noContent();
}
