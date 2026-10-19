import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

/**
 * Estado del servicio para monitoreo (uptime) y para verificar un despliegue.
 * Hace una consulta mínima a la base con el rol anónimo (la misma RPC del
 * catálogo público, con un slug que no existe): no expone datos ni detalles
 * del error. También mantiene activo el proyecto gratuito de Supabase, que se
 * pausa tras 7 días sin actividad (ver .github/workflows/keepalive.yml).
 */
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';
  const headers = { 'Cache-Control': 'no-store' };
  if (!isSupabaseConfigured) return NextResponse.json({ status: 'ok', database: 'not_configured', version }, { headers });

  const started = Date.now();
  const { error } = await createPublicClient().rpc('get_public_catalog', { p_business_slug: '__health__' });
  const latencyMs = Date.now() - started;
  if (error) {
    console.error('[health] la base no respondió', { code: error.code });
    return NextResponse.json({ status: 'degraded', database: 'error', version }, { status: 503, headers });
  }
  return NextResponse.json({ status: 'ok', database: 'ok', latencyMs, version }, { headers });
}
