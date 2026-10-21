import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';

/**
 * Lo común a los avisos anónimos del sitio publicado (visitas, pedidos,
 * búsquedas sin resultado, reseñas): el cuerpo JSON se acepta sólo del mismo
 * origen, con un tope de tamaño y con la forma del schema. Las rutas deciden
 * qué hacer con el cuerpo válido.
 */
type ReadJsonBody<S extends z.ZodType> = { ok: true; body: z.output<S> } | { ok: false; response: NextResponse };

export async function readJsonBody<S extends z.ZodType>(request: NextRequest, schema: S, { maxBytes }: { maxBytes: number }): Promise<ReadJsonBody<S>> {
  const fail = (status: number): ReadJsonBody<S> => ({ ok: false, response: new NextResponse(null, { status }) });
  // Sólo desde el propio sitio (otro origen no puede avisar por él).
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return fail(403);
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return fail(413);

  let text: string;
  try {
    text = await request.text();
  } catch {
    return fail(400);
  }
  if (text.length > maxBytes) return fail(413);
  try {
    return { ok: true, body: schema.parse(JSON.parse(text)) };
  } catch {
    return fail(400);
  }
}

/** Robots, rastreadores y vistas previas de enlaces: no son visitantes. */
const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse/i;
export const isBot = (request: NextRequest) => BOTS.test(request.headers.get('user-agent') ?? '');

/** 204 sin caché: el visitante no espera respuesta y no se revela si se contó. */
export const noContent = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
