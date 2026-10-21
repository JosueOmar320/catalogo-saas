import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { guardAssistantRequest, logAssistantError } from '@/features/assistant/server/guard';
import { describeModelError, getAssistantModel } from '@/features/assistant/server/model';
import { createToolRunner, serverContext, validatedMedia } from '@/features/assistant/server/tool-runner';
import { canManageCatalog } from '@/lib/auth/session';
import { assistantContextSchema } from '@/lib/assistant/context';
import { parseModeActions } from '@/lib/assistant/modes';
import { resolveMediaQueries } from '@/features/assistant/server/resolve-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** El editor manda el contexto del sitio (páginas, secciones): más grande que un pedido del panel. */
const MAX_BODY = 200_000;

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(24)
    .refine((list) => list[list.length - 1].role === 'user', 'El último mensaje debe ser del usuario'),
  context: assistantContextSchema,
});

/**
 * Garfield AI. Interpreta el pedido y devuelve acciones propuestas; no edita
 * el sitio: el editor valida y ejecuta las acciones en el borrador, y los
 * cambios se guardan con saveSite (Zod + RLS) como siempre. La única escritura
 * aquí es aditiva: importar a la biblioteca las fotos libres que el pedido usa.
 */
export async function POST(request: NextRequest) {
  // Sesión, permiso de edición, límites y cuerpo validado; el idioma de la app del usuario
  // traduce los errores y el modelo le responde en ese idioma.
  const guarded = await guardAssistantRequest(request, requestSchema, {
    maxBody: MAX_BODY,
    forbid: (ctx, t) => (canManageCatalog(ctx) ? null : t('Sólo el dueño o un administrador puede editar el sitio.')),
  });
  if (!guarded.ok) return guarded.response;
  const { ctx, data, t, locale } = guarded;
  // El contexto describe SIEMPRE el negocio de la sesión (no se confía en el cliente para eso)
  // y el servidor agrega las imágenes y productos reales.
  const messages = data.messages.slice(-16);
  const context = {
    ...data.context,
    business: { name: ctx.business.name, slogan: ctx.business.slogan ?? '', description: (ctx.business.description ?? '').slice(0, 400) },
    ...(await serverContext(ctx)),
  };
  const { runner, toolContext } = createToolRunner(ctx, messages);

  try {
    const result = await getAssistantModel().respond({ messages, context, tools: runner, locale });
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
    const resolved = await resolveMediaQueries({ supabase: ctx.supabase, businessId: ctx.business.id }, result.actions, undefined, stock, t);
    const { actions, errors } = parseModeActions(context.mode, resolved.actions);
    // Imágenes que el editor puede usar: sólo las que existen en la biblioteca del negocio.
    const allowedMedia = await validatedMedia(ctx, actions, new Set([...toolContext.media, ...resolved.seen]));
    const message = resolved.notes.length ? `${result.message}\n\n${resolved.notes.join(' ')}` : result.message;
    return NextResponse.json({ ...result, message, actions, warnings: [...result.warnings, ...errors], allowedMedia }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logAssistantError('[assistant]', error);
    const { status, message, params } = describeModelError(error);
    return NextResponse.json({ error: t(message, params) }, { status });
  }
}
