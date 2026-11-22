import { NextResponse, type NextRequest } from 'next/server';
import { parseAnalyticsSummary } from '@/features/analytics/queries';
import { listItemsWithImages } from '@/features/catalog/queries';
import { listItemPerformance } from '@/features/views/queries';
import { getT } from '@/i18n/server';
import { getBusinessContext } from '@/lib/auth/session';
import { utcDay, windowStart } from '@/lib/orders/stats';
import { dailyReportCsv, productReportCsv, REPORT_DAYS } from '@/lib/reports/stats-csv';

/**
 * Reporte de los últimos 30 días del negocio activo en CSV:
 *   ?tipo=dias       visitas, fichas vistas, pedidos, unidades y valor por día
 *   ?tipo=productos  visitas y unidades pedidas por producto o servicio
 * Lee los contadores con la sesión del usuario (RLS: sólo su negocio),
 * agregados en la base (analytics_summary / item_performance): PostgREST
 * corta en 1000 filas y las lecturas por día e ítem quedaban incompletas.
 * Si las funciones aún no existen, los contadores cuentan como cero.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Sitio web sin catálogo: no hay productos, pedidos ni estadísticas de catálogo que exportar.
  if (ctx.siteKind !== 'catalog' || !ctx.features.analytics) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const kind = request.nextUrl.searchParams.get('tipo') === 'productos' ? 'productos' : 'dias';
  const today = new Date();
  const since = windowStart(today, REPORT_DAYS);
  const t = await getT();
  const business = ctx.business.id;

  let csv: string;
  if (kind === 'dias') {
    const { data } = await ctx.supabase.rpc('analytics_summary', { p_business: business, p_since: since, p_until: utcDay(today) });
    const stats = parseAnalyticsSummary(data);
    const counts = new Map<string, { views?: number; itemViews?: number; orders?: number; units?: number; value?: number }>();
    const at = (day: string) => counts.get(day) ?? (counts.set(day, {}), counts.get(day)!);
    for (const row of stats.page_views) at(row.day).views = row.views;
    for (const row of stats.item_views) at(row.day).itemViews = row.views;
    for (const row of stats.orders) Object.assign(at(row.day), { orders: row.orders, units: row.units, value: Number(row.value) });
    csv = dailyReportCsv(t, counts, today);
  } else {
    const [items, performance] = await Promise.all([listItemsWithImages(ctx), listItemPerformance(ctx, since).catch(() => [])]);
    csv = productReportCsv(
      t,
      items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, type: i.type })),
      new Map(performance.map((row) => [row.item_id, row.views])),
      new Map(performance.map((row) => [row.item_id, row.units])),
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
