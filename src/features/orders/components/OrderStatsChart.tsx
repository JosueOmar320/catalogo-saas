'use client';

import { Box, Tooltip, Typography } from '@mui/material';
import { useT } from '@/i18n/client';

type Props = { days: { day: string; orders: number }[]; locale: string };

/**
 * Pedidos por día (una sola serie): barras finas ancladas a la base, extremo
 * redondeado de 4 px, 2 px de separación y tooltip por barra. Los días sin
 * pedidos dejan una marca mínima para que la línea de tiempo se lea completa.
 * Para lectores de pantalla, la misma información va en una tabla oculta.
 */
export function OrderStatsChart({ days, locale }: Props) {
  const t = useT();
  const max = Math.max(1, ...days.map((d) => d.orders));
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const label = (day: string) => format.format(new Date(`${day}T00:00:00Z`));
  const tooltip = (d: { day: string; orders: number }) => (d.orders === 1 ? t('{date}: 1 pedido', { date: label(d.day) }) : t('{date}: {count} pedidos', { date: label(d.day), count: d.orders }));

  return (
    <Box>
      <Box aria-hidden sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 72, borderBottom: 1, borderColor: 'divider' }}>
        {days.map((d) => (
          <Tooltip key={d.day} title={tooltip(d)} placement="top" disableInteractive>
            {/* Zona de hover de toda la columna, más grande que la barra. */}
            <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default', '&:hover > span': { opacity: 0.75 } }}>
              <Box
                component="span"
                sx={{
                  display: 'block',
                  width: '100%',
                  height: d.orders ? `${Math.max(8, (d.orders / max) * 100)}%` : '2px',
                  bgcolor: d.orders ? 'primary.main' : 'divider',
                  borderRadius: d.orders ? '4px 4px 0 0' : 0,
                }}
              />
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Box aria-hidden sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label(days[0].day)}</Typography>
        <Typography variant="caption" color="text.secondary">{t('Hoy')}</Typography>
      </Box>
      {/* Oculta pero legible para lectores de pantalla (una tabla no se encoge a 1 px: va dentro de un div). */}
      <Box sx={visuallyHidden}>
        <table>
          <caption>{t('Pedidos por día, últimos 30 días')}</caption>
          <thead>
            <tr><th scope="col">{t('Día')}</th><th scope="col">{t('Pedidos')}</th></tr>
          </thead>
          <tbody>
            {days.filter((d) => d.orders > 0).map((d) => (
              <tr key={d.day}><td>{label(d.day)}</td><td>{d.orders}</td></tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}

// Con unidades explícitas: en `sx`, width: 1 significa 100 %, no 1 px.
const visuallyHidden = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;
