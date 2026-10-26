import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { getLocale, getT } from '@/i18n/server';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/translate';
import { getBusinessContext, type BusinessContext } from '@/lib/auth/session';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { checkRateLimit } from './rate-limit';

const MAX_BODY = 40_000;
/** Cupo diario por usuario, compartido por todas las rutas: Garfield es uno solo. */
const DAILY_REQUESTS = 300;
/** Cuentas de prueba («Probar el panel»): menos por cuenta y un tope entre todas (cada visitante tiene la suya). */
const DEMO_DAILY_REQUESTS = 40;
const DEMO_DAILY_TOTAL = 500;

type Guarded<T> = { ok: true; ctx: BusinessContext; data: T; t: Translator; locale: Locale } | { ok: false; response: NextResponse };

type GuardOptions = {
  /** Tope del cuerpo en bytes (el editor manda el contexto del sitio: más grande). */
  maxBody?: number;
  /** Permiso adicional sobre la sesión: devuelve el mensaje de error (403) o null si puede seguir. */
  forbid?: (ctx: BusinessContext, t: Translator) => string | null;
};

/**
 * Lo común a las rutas de Garfield: sesión con negocio (y el permiso que pida
 * la ruta), límites de ráfaga y diario, tamaño y Zod. Las respuestas de error
 * ya van traducidas al idioma del usuario.
 */
export async function guardAssistantRequest<S extends z.ZodType>(request: NextRequest, schema: S, { maxBody = MAX_BODY, forbid }: GuardOptions = {}): Promise<Guarded<z.output<S>>> {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const fail = (status: number, error: string, headers?: Record<string, string>) => ({ ok: false as const, response: NextResponse.json({ error }, { status, headers }) });
  const ctx = await getBusinessContext();
  if (!ctx) return fail(401, t('Inicia sesión para usar a Garfield.'));
  if (!ctx.features.assistant) return fail(403, t('Garfield no está disponible para tu cuenta. Pídeselo al administrador de la plataforma.'));
  const forbidden = forbid?.(ctx, t);
  if (forbidden) return fail(403, forbidden);

  const limit = checkRateLimit(ctx.userId);
  if (!limit.ok) return fail(429, t('Garfield necesita una siesta corta. Intenta en {seconds} s.', { seconds: limit.retryAfter }), { 'Retry-After': String(limit.retryAfter) });
  if (!(await consumeRateLimit(`assistant:${ctx.userId}`, ctx.demoExpiresAt ? DEMO_DAILY_REQUESTS : DAILY_REQUESTS, 86_400))) return fail(429, t('Garfield ya trabajó mucho hoy. Vuelve mañana o sigue editando a mano.'), { 'Retry-After': '3600' });
  if (ctx.demoExpiresAt && !(await consumeRateLimit('assistant:demo', DEMO_DAILY_TOTAL, 86_400))) return fail(429, t('Garfield ya trabajó mucho hoy. Vuelve mañana o sigue editando a mano.'), { 'Retry-After': '3600' });

  if (Number(request.headers.get('content-length') ?? 0) > maxBody) return fail(413, t('El pedido es demasiado grande.'));
  const raw = await request.text();
  if (raw.length > maxBody) return fail(413, t('El pedido es demasiado grande.'));
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, t('Pedido inválido.'));
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(400, t('Pedido inválido.'));
  return { ok: true, ctx, data: parsed.data, t, locale };
}

/**
 * Registro de un fallo de Garfield sin el objeto completo: un error del
 * proveedor puede traer el prompt (textos del negocio) en su cuerpo. Sólo el
 * tipo, el estado o código y el mensaje recortado.
 */
export function logAssistantError(scope: string, error: unknown): void {
  const e = (typeof error === 'object' && error !== null ? error : {}) as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
  console.error(scope, {
    name: typeof e.name === 'string' ? e.name : typeof error,
    status: typeof e.status === 'number' ? e.status : (typeof e.code === 'string' || typeof e.code === 'number' ? e.code : null),
    message: String(typeof e.message === 'string' ? e.message : error).slice(0, 200),
  });
}
