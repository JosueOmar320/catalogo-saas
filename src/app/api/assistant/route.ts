import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { describeModelError, getAssistantModel } from '@/features/assistant/server/model';
import { checkRateLimit } from '@/features/assistant/server/rate-limit';
import { createToolRunner, serverContext, validatedMedia } from '@/features/assistant/server/tool-runner';
import { canManageCatalog, getBusinessContext } from '@/lib/auth/session';
import { assistantContextSchema } from '@/lib/assistant/context';
import { parseModeActions } from '@/lib/assistant/modes';
import { resolveMediaQueries } from '@/features/assistant/server/resolve-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(24)
    .refine((list) => list[list.length - 1].role === 'user', 'El último mensaje debe ser del usuario'),
  context: assistantContextSchema,
});

/**
 * Garfield AI. Interpreta el pedido y devuelve acciones propuestas; NO
 * escribe en la base de datos. El editor valida y ejecuta las acciones en el
 * borrador, y los cambios se guardan con saveSite (Zod + RLS) como siempre.
 */
export async function POST(request: NextRequest) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Inicia sesión para usar a Garfield.' }, { status: 401 });
  if (!canManageCatalog(ctx)) return NextResponse.json({ error: 'Sólo el dueño o un administrador puede editar el sitio.' }, { status: 403 });

  const limit = checkRateLimit(ctx.userId);
  if (!limit.ok) return NextResponse.json({ error: `Garfield necesita una siesta corta. Intenta en ${limit.retryAfter} s.` }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });

  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: 'El pedido es demasiado grande.' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  // El contexto describe SIEMPRE el negocio de la sesión (no se confía en el cliente para eso)
  // y el servidor agrega las imágenes y productos reales.
  const messages = parsed.data.messages.slice(-16);
  const context = {
    ...parsed.data.context,
    business: { name: ctx.business.name, slogan: ctx.business.slogan ?? '', description: (ctx.business.description ?? '').slice(0, 400) },
    ...(await serverContext(ctx)),
  };
  const { runner, toolContext } = createToolRunner(ctx, messages);

  try {
    const result = await getAssistantModel().respond({ messages, context, tools: runner });
    // Imágenes pedidas por descripción ("una foto de comida") → rutas reales de la biblioteca.
    // Fotos libres (CC0) cuando la biblioteca no tiene lo pedido. Si la búsqueda es muy específica
    // ("laboratory dark scary") y no hay resultados, se reintenta con menos palabras.
    const stock = async (query: string, count: number) => {
      const words = query.trim().split(/\s+/);
      const attempts = [...new Set([words.join(' '), words.slice(0, 2).join(' '), words[0]])].filter((q) => q.length >= 2);
      let results: { ref: string }[] = [];
      for (const attempt of attempts) {
        const search = await runner.run('search_stock_images', { query: attempt.slice(0, 80), limit: Math.min(count + 2, 8) });
        results = search.ok ? (search.result as { results: { ref: string }[] }).results : [];
        if (results.length) break;
      }
      // En paralelo (cada una se descarga y procesa). Sólo las necesarias: no se llena la biblioteca de sobrantes.
      const imports = await Promise.all(results.slice(0, count).map(({ ref }) => runner.run('import_image', { ref, alt: query.slice(0, 200).padEnd(2, '.') })));
      return imports.flatMap((r) => (r.ok ? [(r.result as { path: string }).path] : [])).slice(0, count);
    };
    const resolved = await resolveMediaQueries({ supabase: ctx.supabase, businessId: ctx.business.id }, result.actions, undefined, stock);
    const { actions, errors } = parseModeActions(context.mode, resolved.actions);
    // Imágenes que el editor puede usar: sólo las que existen en la biblioteca del negocio.
    const allowedMedia = await validatedMedia(ctx, actions, new Set([...toolContext.media, ...resolved.seen]));
    const message = resolved.notes.length ? `${result.message}\n\n${resolved.notes.join(' ')}` : result.message;
    return NextResponse.json({ ...result, message, actions, warnings: [...result.warnings, ...errors], allowedMedia }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[assistant]', error);
    const { status, message } = describeModelError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
