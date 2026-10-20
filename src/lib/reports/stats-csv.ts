import { toCsv } from '@/lib/catalog/csv';
import type { Translator } from '@/i18n/translate';
import { utcDay } from '@/lib/orders/stats';

/**
 * Reportes descargables (CSV) de los últimos N días a partir de los
 * contadores diarios: por día (visitas, fichas vistas, pedidos, unidades,
 * valor) y por producto (visitas y unidades pedidas). Puro.
 */
export const REPORT_DAYS = 30;

type DayCounts = { views?: number; itemViews?: number; orders?: number; units?: number; value?: number };

/** Una fila por día (el más antiguo primero), también los días en cero; al final, los totales. */
export function dailyReportCsv(t: Translator, counts: Map<string, DayCounts>, today: Date, days = REPORT_DAYS): string {
  const rows: string[][] = [[t('Fecha'), t('Visitas'), t('Fichas vistas'), t('Pedidos'), t('Unidades'), t('Valor estimado')]];
  const total = { views: 0, itemViews: 0, orders: 0, units: 0, value: 0 };
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = utcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset)));
    const c = counts.get(day) ?? {};
    const row = { views: c.views ?? 0, itemViews: c.itemViews ?? 0, orders: c.orders ?? 0, units: c.units ?? 0, value: Math.round((c.value ?? 0) * 100) / 100 };
    for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += row[key];
    rows.push([day, String(row.views), String(row.itemViews), String(row.orders), String(row.units), row.value.toFixed(2)]);
  }
  rows.push([t('Total'), String(total.views), String(total.itemViews), String(total.orders), String(total.units), (Math.round(total.value * 100) / 100).toFixed(2)]);
  return toCsv(rows);
}

/** Una fila por producto o servicio, los más pedidos y vistos primero. */
export function productReportCsv(t: Translator, items: { id: string; name: string; sku: string | null; type: 'product' | 'service' }[], views: Map<string, number>, units: Map<string, number>): string {
  const rows = items
    .map((item) => ({ ...item, views: views.get(item.id) ?? 0, units: units.get(item.id) ?? 0 }))
    .sort((a, b) => b.units - a.units || b.views - a.views || a.name.localeCompare(b.name));
  return toCsv([
    [t('Nombre'), t('Código'), t('Tipo'), t('Visitas a la ficha'), t('Unidades pedidas')],
    ...rows.map((row) => [row.name, row.sku ?? '', row.type === 'product' ? t('Producto') : t('Servicio'), String(row.views), String(row.units)]),
  ]);
}
