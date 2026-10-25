import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isBot, noContent, readJsonBody } from '@/lib/api/beacon';
import { isSupabaseConfigured } from '@/lib/env';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * El sitio publicado avisa un paso del recorrido de una visita (llegó y de
 * dónde, vio su primera ficha, agregó un producto al pedido). Sólo se suman
 * contadores por día, origen y producto: no llega nada del visitante. La
 * validación de fondo (sitio publicado, producto de ese catálogo, origen
 * conocido) la hace record_funnel; aquí se filtra la forma, los robots y el ritmo.
 *
 * Responde 204 aunque no cuente: tampoco sirve para averiguar qué existe.
 */
const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  event: z.enum(['session', 'product', 'add']),
  source: z.string().regex(/^[a-z]{1,20}$/).default('direct'),
  // Un id que no es de un producto (p. ej. una línea con opciones) simplemente no cuenta para el producto.
  item: z.string().max(120).optional(),
  start: z.boolean().default(false),
});

const MAX_BYTES = 1_000;
// Por IP y negocio, compartido con las visitas: navegar y armar un pedido es normal; miles de pasos en una hora, no.
const LIMIT = 300;
const WINDOW_SECONDS = 3600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const read = await readJsonBody(request, bodySchema, { maxBytes: MAX_BYTES });
  if (!read.ok) return read.response;
  const { body } = read;

  if (isBot(request)) return noContent();
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return noContent();
  if (!(await consumeRateLimit(`funnel:${await clientIp()}:${body.slug}`, LIMIT, WINDOW_SECONDS))) {
    return new NextResponse(null, { status: 429 });
  }

  const item = body.item && UUID.test(body.item) ? body.item : null;
  const { error } = await createAdminClient().rpc('record_funnel', { p_business_slug: body.slug, p_event: body.event, p_source: body.source, p_item_id: item, p_cart_start: body.start });
  if (error) console.error('[funnel] no se pudo registrar el paso', { code: error.code });
  return noContent();
}
