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
/** Mismo cupo diario que el editor: Garfield es uno solo. */
const DAILY_REQUESTS = 300;

type Guarded<T> = { ok: true; ctx: BusinessContext; data: T; t: Translator; locale: Locale } | { ok: false; response: NextResponse };

/**
 * Lo común a las rutas de Garfield fuera de los editores: sesión con negocio,
 * límites de ráfaga y diario (compartidos con el editor), tamaño y Zod.
 */
export async function guardAssistantRequest<S extends z.ZodType>(request: NextRequest, schema: S): Promise<Guarded<z.output<S>>> {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const fail = (status: number, error: string, headers?: Record<string, string>) => ({ ok: false as const, response: NextResponse.json({ error }, { status, headers }) });
  const ctx = await getBusinessContext();
  if (!ctx) return fail(401, t('Inicia sesión para usar a Garfield.'));

  const limit = checkRateLimit(ctx.userId);
  if (!limit.ok) return fail(429, t('Garfield necesita una siesta corta. Intenta en {seconds} s.', { seconds: limit.retryAfter }), { 'Retry-After': String(limit.retryAfter) });
  if (!(await consumeRateLimit(`assistant:${ctx.userId}`, DAILY_REQUESTS, 86_400))) return fail(429, t('Garfield ya trabajó mucho hoy. Vuelve mañana o sigue editando a mano.'), { 'Retry-After': '3600' });

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return fail(413, t('El pedido es demasiado grande.'));
  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, t('El pedido es demasiado grande.'));
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
