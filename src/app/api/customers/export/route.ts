import { NextResponse, type NextRequest } from 'next/server';
import { listCustomers } from '@/features/customers/queries';
import { getT } from '@/i18n/server';
import { getBusinessContext } from '@/lib/auth/session';
import { parseContact } from '@/lib/business/profile';
import { customersCsv, findSort } from '@/lib/orders/customers';

/** Clientes en CSV (?orden=…&q=…), con la sesión del usuario (RLS: sólo su negocio). */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (ctx.siteKind !== 'catalog') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const params = request.nextUrl.searchParams;
  const customers = await listCustomers(ctx, { sort: findSort(params.get('orden')), query: (params.get('q') ?? '').slice(0, 60) });
  if (customers === null) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const timeZone = parseContact(ctx.business.contact).schedule.timezone || 'UTC';
  return new NextResponse(customersCsv(await getT(), customers, timeZone), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-${ctx.business.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
