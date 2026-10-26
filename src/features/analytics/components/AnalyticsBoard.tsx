'use client';

import { Alert, Box, Button, Chip, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { ArrowDownRight, ArrowUpRight, BarChart3, Check, Copy, Download, Minus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useDashboard } from '@/components/dashboard/DashboardContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { SOURCE_LABELS, trackedLink } from '@/lib/analytics/source';
import { ANALYTICS_RANGES, change, type AnalyticsSummary, type FunnelStep, type ProductAnalyticsRow } from '@/lib/analytics/summary';
import { formatPrice } from '@/lib/utils/format';

type Props = {
  summary: AnalyticsSummary;
  products: { top: ProductAnalyticsRow[]; leaks: ProductAnalyticsRow[] };
  /** Dirección pública del sitio (para los enlaces con seguimiento). */
  siteUrl: string;
  published: boolean;
  ordersEnabled: boolean;
  currency: string;
  priceLocale: string;
  locale: string;
};

const RANGE_LABELS: Record<number, string> = { 7: msg('7 días'), 30: msg('30 días'), 90: msg('90 días') };
const STEP_LABELS: Record<FunnelStep['key'], string> = {
  sessions: msg('Visitas'),
  viewedProduct: msg('Vieron un producto'),
  startedCart: msg('Agregaron al pedido'),
  sentOrder: msg('Enviaron el pedido'),
};
/** Enlaces con seguimiento que se ofrecen para copiar. */
const TRACKED = [
  { ref: 'instagram', label: SOURCE_LABELS.instagram },
  { ref: 'facebook', label: SOURCE_LABELS.facebook },
  { ref: 'whatsapp', label: SOURCE_LABELS.whatsapp },
  { ref: 'tiktok', label: SOURCE_LABELS.tiktok },
  { ref: 'google', label: SOURCE_LABELS.google },
  { ref: 'email', label: SOURCE_LABELS.email },
] as const;

/** Variación contra el periodo anterior: ícono + texto (nunca sólo el color). */
function Delta({ current, previous, range, invert = false }: { current: number | null; previous: number | null; range: number; invert?: boolean }) {
  const t = useT();
  const value = change(current, previous);
  if (value === null) return <Typography variant="caption" color="text.secondary">{t('Sin datos del periodo anterior')}</Typography>;
  const up = value > 0;
  const good = value === 0 ? null : invert ? !up : up;
  const Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: good === null ? 'text.secondary' : good ? 'success.main' : 'error.main' }}>
      <Icon size={14} aria-hidden />
      {t('{change} vs. los {days} días anteriores', { change: `${up ? '+' : ''}${value.toLocaleString()} %`, days: range })}
    </Typography>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta: React.ReactNode }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider', minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography component="p" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, lineHeight: 1.2, fontWeight: 700, my: 0.5, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      {delta}
    </Box>
  );
}

/** Barra horizontal de una sola serie: extremo redondeado de 4 px, pista tenue y el valor en texto. */
function HBar({ label, value, max, detail }: { label: string; value: number; max: number; detail?: string }) {
  return (
    <Box component="li" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px minmax(0, 1fr) auto' }, gap: { xs: 0.5, sm: 1.5 }, alignItems: 'center' }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
      <Box sx={{ height: 12, borderRadius: '0 4px 4px 0', bgcolor: 'action.hover', overflow: 'hidden' }} aria-hidden>
        <Box sx={{ height: '100%', width: `${max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0}%`, bgcolor: 'primary.main', borderRadius: '0 4px 4px 0' }} />
      </Box>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: { sm: 'right' } }}>
        <strong>{value.toLocaleString()}</strong>
        {detail && <Typography component="span" variant="caption" color="text.secondary">{` · ${detail}`}</Typography>}
      </Typography>
    </Box>
  );
}

/** Una serie por día: barras finas ancladas a la base, 2 px de separación y tooltip por barra; tabla oculta para lectores de pantalla. */
function DailyBars({ days, tooltip, caption, header, locale }: { days: { day: string; count: number }[]; tooltip: (count: number, date: string) => string; caption: string; header: string; locale: string }) {
  const t = useT();
  const max = Math.max(1, ...days.map((d) => d.count));
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const label = (day: string) => format.format(new Date(`${day}T00:00:00Z`));
  return (
    <Box>
      <Box aria-hidden sx={{ display: 'flex', alignItems: 'flex-end', gap: days.length > 45 ? '1px' : '2px', height: 96, borderBottom: 1, borderColor: 'divider' }}>
        {days.map((d) => (
          <Tooltip key={d.day} title={tooltip(d.count, label(d.day))} placement="top" disableInteractive>
            <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', '&:hover > span': { opacity: 0.75 } }}>
              <Box component="span" sx={{ display: 'block', width: '100%', height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : '2px', bgcolor: d.count ? 'primary.main' : 'divider', borderRadius: d.count ? '4px 4px 0 0' : 0 }} />
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Box aria-hidden sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label(days[0].day)}</Typography>
        <Typography variant="caption" color="text.secondary">{t('Hoy')}</Typography>
      </Box>
      <Box sx={visuallyHidden}>
        <table>
          <caption>{caption}</caption>
          <thead><tr><th scope="col">{t('Día')}</th><th scope="col">{header}</th></tr></thead>
          <tbody>{days.filter((d) => d.count > 0).map((d) => <tr key={d.day}><td>{label(d.day)}</td><td>{d.count}</td></tr>)}</tbody>
        </table>
      </Box>
    </Box>
  );
}

function TrackedLinks({ siteUrl }: { siteUrl: string }) {
  const t = useT();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (ref: string) => {
    const done = await navigator.clipboard.writeText(trackedLink(siteUrl, ref)).then(() => true, () => false);
    if (done) {
      setCopied(ref);
      setTimeout(() => setCopied(null), 1500);
    }
  };
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
      {TRACKED.map(({ ref, label }) => (
        <Chip
          key={ref}
          variant="outlined"
          icon={copied === ref ? <Check size={14} /> : <Copy size={14} />}
          label={copied === ref ? t('Copiado') : t('Enlace para {source}', { source: t(label) })}
          onClick={() => void copy(ref)}
          aria-label={t('Copiar el enlace para {source}', { source: t(label) })}
        />
      ))}
    </Stack>
  );
}

const visuallyHidden = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;

/** Analítica de ventas: el periodo contra el anterior, el recorrido de las visitas, de dónde llegan y los productos. */
export function AnalyticsBoard({ summary, products, siteUrl, published, ordersEnabled, currency, priceLocale, locale }: Props) {
  const t = useT();
  // En la cuenta de prueba los números son de ejemplo: el aviso de «no publicado» confundiría.
  const { demo } = useDashboard();
  const { current, previous, range } = summary;
  const money = (value: number | null) => (value === null ? '—' : formatPrice(value, currency || 'MXN', priceLocale));
  const percent = (value: number | null) => (value === null ? '—' : `${value.toLocaleString()} %`);
  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const nothing = current.sessions === 0 && current.pageViews === 0 && current.orders === 0;
  const maxSource = Math.max(0, ...summary.sources.map((s) => s.sessions));

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
        <Tabs value={range} aria-label={t('Periodo')} sx={{ flex: 1, minHeight: 40 }}>
          {ANALYTICS_RANGES.map((days) => (
            <Tab key={days} value={days} label={t(RANGE_LABELS[days])} component={Link} href={days === 30 ? '/dashboard/estadisticas' : `/dashboard/estadisticas?dias=${days}`} sx={{ minHeight: 40 }} />
          ))}
        </Tabs>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<Download size={14} />} href="/api/stats/export?tipo=dias">{t('Reporte por día')}</Button>
          <Button size="small" startIcon={<Download size={14} />} href="/api/stats/export?tipo=productos">{t('Reporte por producto')}</Button>
        </Stack>
      </Stack>

      {!published && !demo && <Alert severity="info">{t('Tu sitio no está publicado: las visitas se cuentan sólo en el sitio publicado.')}</Alert>}
      {summary.funnelSince === null ? (
        <Alert severity="info">{t('El recorrido de las visitas y de dónde llegan se empiezan a contar ahora: vuelve en unos días para verlo.')}</Alert>
      ) : (
        summary.funnelSince > summary.from && <Alert severity="info">{t('El recorrido y los orígenes se cuentan desde el {date}.', { date: dateFormat.format(new Date(`${summary.funnelSince}T00:00:00Z`)) })}</Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        <Kpi label={t('Visitas')} value={current.sessions.toLocaleString()} delta={<Delta current={current.sessions} previous={previous.sessions} range={range} />} />
        <Kpi label={t('Pedidos')} value={current.orders.toLocaleString()} delta={<Delta current={current.orders} previous={previous.orders} range={range} />} />
        <Kpi label={t('Conversión')} value={percent(summary.conversion.current)} delta={<Delta current={summary.conversion.current} previous={summary.conversion.previous} range={range} />} />
        <Kpi label={t('Valor estimado')} value={money(current.value)} delta={<Delta current={current.value} previous={previous.value} range={range} />} />
        <Kpi label={t('Ticket promedio')} value={money(summary.ticket.current)} delta={<Delta current={summary.ticket.current} previous={summary.ticket.previous} range={range} />} />
      </Box>

      {nothing ? (
        <EmptyState icon={BarChart3} title={t('Todavía no hay visitas ni pedidos en este periodo.')} description={t('Comparte el enlace de tu sitio (abajo tienes enlaces que dicen de dónde llega cada visita).')} />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5 }}>
          <SectionCard title={t('Recorrido de las visitas')} description={t('De cada 100 visitas, cuántas avanzan a cada paso.')}>
            <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label={t('Recorrido de las visitas')}>
              {summary.funnel.map((step, index) => (
                <HBar
                  key={step.key}
                  label={t(STEP_LABELS[step.key])}
                  value={step.value}
                  max={summary.funnel[0].value}
                  detail={index === 0 ? undefined : t('{percent} de las visitas', { percent: percent(step.ofVisits) })}
                />
              ))}
            </Stack>
            {ordersEnabled && current.startedCart > current.sentOrder && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('{count} pedidos empezados no se enviaron. Revisa el pedido mínimo, el envío y que tus precios estén claros.', { count: (current.startedCart - current.sentOrder).toLocaleString() })}
              </Typography>
            )}
          </SectionCard>

          <SectionCard title={t('De dónde llegan')} description={t('Visitas y pedidos por origen.')}>
            {summary.sources.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('Aún no hay visitas con origen en este periodo.')}</Typography>
            ) : (
              <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label={t('De dónde llegan')}>
                {summary.sources.map((source) => (
                  <HBar
                    key={source.source}
                    label={t(SOURCE_LABELS[source.source])}
                    value={source.sessions}
                    max={maxSource}
                    detail={source.orders === 1 ? t('1 pedido ({percent})', { percent: percent(source.conversion) }) : t('{count} pedidos ({percent})', { count: source.orders, percent: percent(source.conversion) })}
                  />
                ))}
              </Stack>
            )}
          </SectionCard>

          <SectionCard title={t('Visitas por día')}>
            <DailyBars
              days={summary.days.map((d) => ({ day: d.day, count: d.sessions }))}
              tooltip={(count, date) => (count === 1 ? t('{date}: 1 visita', { date }) : t('{date}: {count} visitas', { date, count }))}
              caption={t('Visitas por día, últimos {days} días', { days: range })}
              header={t('Visitas')}
              locale={locale}
            />
          </SectionCard>

          <SectionCard title={t('Pedidos por día')}>
            <DailyBars
              days={summary.days.map((d) => ({ day: d.day, count: d.orders }))}
              tooltip={(count, date) => (count === 1 ? t('{date}: 1 pedido', { date }) : t('{date}: {count} pedidos', { date, count }))}
              caption={t('Pedidos por día, últimos {days} días', { days: range })}
              header={t('Pedidos')}
              locale={locale}
            />
          </SectionCard>
        </Box>
      )}

      {products.top.length > 0 && (
        <SectionCard title={t('Productos')} description={t('Vistas de la ficha, veces que se agregó a un pedido y unidades pedidas.')} flush>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { px: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider', textAlign: 'left' }, '& td.num, & th.num': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}>
            <thead>
              <tr>
                <Typography component="th" variant="caption" color="text.secondary" scope="col">{t('Producto')}</Typography>
                <Typography component="th" variant="caption" color="text.secondary" scope="col" className="num">{t('Vistas')}</Typography>
                <Typography component="th" variant="caption" color="text.secondary" scope="col" className="num">{t('Agregados')}</Typography>
                <Typography component="th" variant="caption" color="text.secondary" scope="col" className="num">{t('Unidades pedidas')}</Typography>
              </tr>
            </thead>
            <tbody>
              {products.top.map((row) => (
                <tr key={row.itemId}>
                  <Typography component="td" variant="body2"><Link href={`/dashboard/catalog/items/${row.itemId}`}>{row.name}</Link></Typography>
                  <Typography component="td" variant="body2" className="num">{row.views.toLocaleString()}</Typography>
                  <Typography component="td" variant="body2" className="num">{row.adds.toLocaleString()}</Typography>
                  <Typography component="td" variant="body2" className="num">{row.units.toLocaleString()}</Typography>
                </tr>
              ))}
            </tbody>
          </Box>
          {products.leaks.length > 0 && (
            <Box sx={{ px: 2.5, py: 2 }}>
              <Typography variant="subtitle2">{t('Se agregan, pero casi no se piden')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('Revisa su precio, sus fotos o si tienen existencias.')}</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                {products.leaks.map((row) => (
                  <Chip key={row.itemId} component={Link} href={`/dashboard/catalog/items/${row.itemId}`} clickable variant="outlined" label={t('{name}: {adds} agregados, {units} pedidos', { name: row.name, adds: row.adds, units: row.units })} />
                ))}
              </Stack>
            </Box>
          )}
        </SectionCard>
      )}

      <SectionCard title={t('Enlaces con seguimiento')} description={t('Usa un enlace distinto en cada lugar (tu bio de Instagram, tus publicaciones, correos…) para saber de dónde llega cada visita. Tus códigos QR ya lo hacen solos.')}>
        <TrackedLinks siteUrl={siteUrl} />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
          {t('Sólo se cuentan visitas, pasos y pedidos por día y origen: no se guarda nada de quien visita tu sitio.')}
        </Typography>
      </SectionCard>
    </Stack>
  );
}
