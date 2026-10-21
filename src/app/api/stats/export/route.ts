import { NextResponse, type NextRequest } from 'next/server';
import { listItemsWithImages } from '@/features/catalog/queries';
import { getT } from '@/i18n/server';
import { getBusinessContext } from '@/lib/auth/session';
import { windowStart } from '@/lib/orders/stats';
import { dailyReportCsv, productReportCsv, REPORT_DAYS } from '@/lib/reports/stats-csv';

/**
 * Reporte de los últimos 30 días del negocio activo en CSV:
 *   ?tipo=dias       visitas, fichas vistas, pedidos, unidades y valor por día
 *   ?tipo=productos  visitas y unidades pedidas por producto o servicio
 * Lee los contadores con la sesión del usuario (RLS: sólo su negocio). Las
 * tablas que aún no existan cuentan como cero.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Sitio web sin catálogo: no hay productos, pedidos ni estadísticas de catálogo que exportar.
  if (ctx.siteKind !== 'catalog') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const kind = request.nextUrl.searchParams.get('tipo') === 'productos' ? 'productos' : 'dias';
  const today = new Date();
  const since = windowStart(today, REPORT_DAYS);
  const t = await getT();
  const business = ctx.business.id;

  let csv: string;
  if (kind === 'dias') {
    const [views, itemViews, orders] = await Promise.all([
      ctx.supabase.from('site_view_stats_daily').select('day, views').eq('business_id', business).gte('day', since),
      ctx.supabase.from('item_view_stats_daily').select('day, views').eq('business_id', business).gte('day', since).limit(10000),
      ctx.supabase.from('order_stats_daily').select('day, orders, units, value').eq('business_id', business).gte('day', since),
    ]);
    const counts = new Map<string, { views?: number; itemViews?: number; orders?: number; units?: number; value?: number }>();
    const at = (day: string) => counts.get(day) ?? (counts.set(day, {}), counts.get(day)!);
    for (const row of views.data ?? []) at(row.day).views = row.views;
    for (const row of itemViews.data ?? []) at(row.day).itemViews = (at(row.day).itemViews ?? 0) + row.views;
    for (const row of orders.data ?? []) Object.assign(at(row.day), { orders: row.orders, units: row.units, value: Number(row.value) });
    csv = dailyReportCsv(t, counts, today);
  } else {
    const [items, views, units] = await Promise.all([
      listItemsWithImages(ctx),
      ctx.supabase.from('item_view_stats_daily').select('item_id, views').eq('business_id', business).gte('day', since).limit(10000),
      ctx.supabase.from('order_item_stats_daily').select('item_id, units').eq('business_id', business).gte('day', since).limit(10000),
    ]);
    const sum = (rows: { item_id: string; n: number }[]) => rows.reduce((map, row) => map.set(row.item_id, (map.get(row.item_id) ?? 0) + row.n), new Map<string, number>());
    csv = productReportCsv(
      t,
      items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, type: i.type })),
      sum((views.data ?? []).map((r) => ({ item_id: r.item_id, n: r.views }))),
      sum((units.data ?? []).map((r) => ({ item_id: r.item_id, n: r.units }))),
    );
  }

  const date = today.toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-${kind}-${ctx.business.slug}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
