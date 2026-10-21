import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isBot, noContent, readJsonBody } from '@/lib/api/beacon';
import { isSupabaseConfigured } from '@/lib/env';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * El sitio publicado avisa que se vio una página (navigator.sendBeacon), y si
 * era una ficha, cuál. Sólo se cuentan visitas por día: no llega ni se guarda
 * nada del visitante. La validación de fondo (negocio publicado, ítem visible
 * de ese catálogo) la hace record_view en la base; aquí se filtra la forma, el
 * origen, los robots y el ritmo.
 *
 * Responde 204 aunque no cuente: tampoco sirve para averiguar qué existe.
 */
const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  item: z
    .string()
    .regex(/^[a-z0-9-]{1,120}$/)
    .nullable()
    .default(null),
});

const MAX_BYTES = 1_000;
// Por IP y negocio: navegar mucho un catálogo es normal; miles de páginas en una hora, no.
const LIMIT = 300;
const WINDOW_SECONDS = 3600;

export async function POST(request: NextRequest) {
  const read = await readJsonBody(request, bodySchema, { maxBytes: MAX_BYTES });
  if (!read.ok) return read.response;
  const { body } = read;

  // Robots y vistas previas de enlaces no son visitas.
  if (isBot(request)) return noContent();
  // Sin base (recién clonado, demo) no hay dónde contar.
  if (!isSupabaseConfigured || !isServiceRoleConfigured()) return noContent();
  if (!(await consumeRateLimit(`view:${await clientIp()}:${body.slug}`, LIMIT, WINDOW_SECONDS))) {
    return new NextResponse(null, { status: 429 });
  }

  const { error } = await createAdminClient().rpc('record_view', { p_business_slug: body.slug, p_item_slug: body.item });
  if (error) console.error('[views] no se pudo registrar la visita', { code: error.code });
  return noContent();
}
