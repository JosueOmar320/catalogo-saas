import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { runCatalogReview } from '@/features/notifications/catalog-review';
import { isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Aviso semanal de pendientes del catálogo. Lo llama Vercel Cron (vercel.json,
 * lunes 15:00 UTC) con `Authorization: Bearer <CRON_SECRET>`. Sin CRON_SECRET
 * no responde a nadie. `?dry=1` calcula a quién se le enviaría, sin enviar.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  const given = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  return secret.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const summary = await runCatalogReview({ dryRun: request.nextUrl.searchParams.get('dry') === '1' });
  console.info('[catalog-review]', summary);
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}
