import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { runCatalogReview } from '@/features/notifications/catalog-review';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Tarea semanal: aviso de pendientes del catálogo y limpieza de datos viejos
 * (purge_old_data). La llama Vercel Cron (vercel.json, lunes 15:00 UTC) con
 * `Authorization: Bearer <CRON_SECRET>`. Sin CRON_SECRET no responde a nadie.
 * `?dry=1` calcula a quién se le enviaría, sin enviar ni borrar nada.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** La función no existe todavía (PostgREST / Postgres): la migración 20261102 no se aplicó en este entorno. */
const MISSING_FUNCTION = new Set(['PGRST202', '42883']);

/** Resúmenes de largo fijo: ni el largo del encabezado ni su contenido cambian el tiempo de comparación. */
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  const given = request.headers.get('authorization') ?? '';
  return secret.length >= 16 && timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}

/** Limpieza de datos viejos (migración 20261102). Sólo la service role puede ejecutarla. */
async function purgeOldData(): Promise<boolean> {
  const admin = createAdminClient();
  // Analítica (migración 20261107): mismo plazo de 400 días; si aún no existe, no frena lo demás.
  const analytics = await admin.rpc('purge_analytics_data');
  if (analytics.error && !MISSING_FUNCTION.has(analytics.error.code ?? '')) console.error('[catalog-review] no se pudo limpiar la analítica', { code: analytics.error.code });
  const { error } = await admin.rpc('purge_old_data');
  if (!error) return true;
  if (MISSING_FUNCTION.has(error.code ?? '')) console.warn('[catalog-review] purge_old_data no existe en esta base (falta la migración 20261102)');
  else console.error('[catalog-review] no se pudo limpiar datos viejos', { code: error.code });
  return false;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const dryRun = request.nextUrl.searchParams.get('dry') === '1';
  const review = await runCatalogReview({ dryRun });
  // La limpieza sólo en la corrida real: en seco no se borra nada.
  const purged = dryRun ? false : await purgeOldData();
  const summary = { ...review, purged };
  console.info('[catalog-review]', summary);
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}
