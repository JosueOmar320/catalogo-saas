import { NextResponse, type NextRequest } from 'next/server';
import { purgeExpiredDemos } from '@/features/demo/server';
import { isCronRequest } from '@/lib/api/cron';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Tarea diaria: borra los negocios de prueba («Probar el panel») vencidos,
 * con sus archivos y cuentas. La llama Vercel Cron (vercel.json) con
 * `Authorization: Bearer <CRON_SECRET>`. También se limpian al crear una demo.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const purged = await purgeExpiredDemos(100);
  console.info('[demo-cleanup]', { purged });
  return NextResponse.json({ purged }, { headers: { 'Cache-Control': 'no-store' } });
}
