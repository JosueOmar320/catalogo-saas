import { NextResponse, type NextRequest } from 'next/server';
import { runCatalogReview } from '@/features/notifications/catalog-review';
import { isCronRequest } from '@/lib/api/cron';
import { wwwCounterpart } from '@/lib/domains/domain';
import { isVercelConfigured, removeProjectDomain } from '@/lib/domains/vercel';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Tarea semanal: aviso de pendientes del catálogo, limpieza de datos viejos
 * (purge_old_data) y liberación de dominios propios que llevan semanas
 * pendientes sin verificarse. La llama Vercel Cron (vercel.json, lunes 15:00
 * UTC) con `Authorization: Bearer <CRON_SECRET>`. Sin CRON_SECRET no responde
 * a nadie. `?dry=1` calcula a quién se le enviaría, sin enviar ni borrar nada.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** La función no existe todavía (PostgREST / Postgres): la migración no se aplicó en este entorno. */
const MISSING_FUNCTION = new Set(['PGRST202', '42883']);
/** Días que un dominio puede quedar pendiente (sin que el DNS apunte) antes de liberarse. */
const STALE_DOMAIN_DAYS = 14;

/** Limpieza de datos viejos (migración 20261102). Sólo la service role puede ejecutarla. */
async function purgeOldData(): Promise<boolean> {
  const admin = createAdminClient();
  // Analítica (migración 20261107): mismo plazo de 400 días; si aún no existe, no frena lo demás.
  // Desde la migración 20261123 purge_old_data ya la incluye; llamarla dos veces no cambia nada.
  const analytics = await admin.rpc('purge_analytics_data');
  if (analytics.error && !MISSING_FUNCTION.has(analytics.error.code ?? '')) console.error('[catalog-review] no se pudo limpiar la analítica', { code: analytics.error.code });
  const { error } = await admin.rpc('purge_old_data');
  if (!error) return true;
  if (MISSING_FUNCTION.has(error.code ?? '')) console.warn('[catalog-review] purge_old_data no existe en esta base (falta la migración 20261102)');
  else console.error('[catalog-review] no se pudo limpiar datos viejos', { code: error.code });
  return false;
}

/** Quita el dominio y su redirección (www ↔ raíz) del proyecto de Vercel (si ya no estaban, no es error). */
async function removeDomainAndAlias(domain: string): Promise<void> {
  const alias = wwwCounterpart(domain);
  // Primero la redirección (Vercel no deja quitar un dominio al que otro redirige).
  if (alias) await removeProjectDomain(alias.name);
  await removeProjectDomain(domain);
}

/**
 * Dominios pendientes desde hace STALE_DOMAIN_DAYS días (migración 20261123):
 * se quitan de Vercel y el negocio vuelve a la dirección de la plataforma, para
 * que nadie «reserve» un dominio que no es suyo. Devuelve cuántos se liberaron.
 */
async function expireStaleDomains(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('stale_pending_domains', { p_days: STALE_DOMAIN_DAYS });
  if (error) {
    if (!MISSING_FUNCTION.has(error.code ?? '')) console.error('[catalog-review] no se pudieron leer los dominios pendientes', { code: error.code });
    return 0;
  }
  let expired = 0;
  for (const row of data ?? []) {
    try {
      if (isVercelConfigured()) await removeDomainAndAlias(row.custom_domain);
      const { error: updateError } = await admin
        .from('businesses')
        .update({ custom_domain: null, custom_domain_status: 'none', custom_domain_checked_at: null })
        .eq('id', row.business_id)
        .eq('custom_domain', row.custom_domain);
      if (updateError) throw updateError;
      expired++;
    } catch (expireError) {
      // Se reintenta en la próxima corrida.
      console.error('[catalog-review] no se pudo liberar un dominio pendiente', { code: (expireError as { code?: string }).code });
    }
  }
  return expired;
}

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const dryRun = request.nextUrl.searchParams.get('dry') === '1';
  const review = await runCatalogReview({ dryRun });
  // La limpieza sólo en la corrida real: en seco no se borra nada.
  const purged = dryRun ? false : await purgeOldData();
  const domainsExpired = dryRun ? 0 : await expireStaleDomains();
  const summary = { ...review, purged, domainsExpired };
  console.info('[catalog-review]', summary);
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}
