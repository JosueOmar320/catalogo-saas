import { NextResponse, type NextRequest } from 'next/server';
import { listOrders } from '@/features/orders/inbox-queries';
import { getT } from '@/i18n/server';
import { getBusinessContext } from '@/lib/auth/session';
import { parseContact } from '@/lib/business/profile';
import { findTab, ordersCsv, parseRange } from '@/lib/orders/inbox';

/** Pedidos de la bandeja en CSV (?estado=…&dias=…), con la sesión del usuario (RLS: sólo su negocio). */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const tab = findTab(params.get('estado') ?? 'todos');
  const days = parseRange(params.get('dias'));
  const orders = await listOrders(ctx, { statuses: tab.statuses, days });
  if (orders === null) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const timeZone = parseContact(ctx.business.contact).schedule.timezone || 'UTC';
  const csv = ordersCsv(await getT(), orders, timeZone);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pedidos-${ctx.business.slug}-${days}d.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
