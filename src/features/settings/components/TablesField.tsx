'use client';

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import { SwitchControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import type { OrderSettings } from '@/lib/catalog/settings';
import { qrSvg } from '@/lib/qr';

const MAX_TABLES = 100;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Enlace del código QR de una mesa: el sitio con ?mesa=N. */
export const tableUrl = (catalogUrl: string, table: number | string) => `${catalogUrl}?mesa=${encodeURIComponent(String(table))}`;

/**
 * Pedidos en mesa: interruptor y hoja con un código QR por mesa para
 * imprimir. Al escanearlo, el pedido va a esa mesa (sin entrega ni dirección).
 */
export function TablesField({ control, catalogUrl, businessName }: { control: Control<OrderSettings>; catalogUrl: string; businessName: string }) {
  const t = useT();
  const enabled = useWatch({ control, name: 'tables' });
  const [count, setCount] = useState('10');
  const total = Math.min(MAX_TABLES, Math.max(1, Math.round(Number(count)) || 1));

  const print = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const cards = Array.from({ length: total }, (_, i) => {
      const label = t('Mesa {table}', { table: i + 1 });
      return `<section><h2>${escapeHtml(label)}</h2>${qrSvg(tableUrl(catalogUrl, i + 1))}<p>${escapeHtml(t('Escanea para ver el menú y pedir'))}</p><small>${escapeHtml(businessName)}</small></section>`;
    }).join('');
    win.document.write(`<!doctype html><html lang="${document.documentElement.lang}"><head><meta charset="utf-8"><title>${escapeHtml(t('Códigos QR de las mesas'))}</title>
<style>@page{size:auto;margin:10mm}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;margin:0}main{display:grid;grid-template-columns:repeat(2,1fr);gap:8mm}section{break-inside:avoid;border:1px dashed #999;border-radius:4mm;padding:6mm;text-align:center}h2{margin:0 0 3mm;font-size:22pt}svg{width:55mm;height:auto}p{margin:3mm 0 1mm;font-size:12pt}small{color:#555}</style></head>
<body><main>${cards}</main></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Stack spacing={1.5}>
      <SwitchControl
        control={control}
        name="tables"
        label={t('Pedidos en mesa')}
        description={t('Pon un código QR en cada mesa: tus clientes piden desde su celular y el mensaje dice la mesa (sin entrega ni dirección).')}
      />
      {enabled && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            size="small"
            type="number"
            label={t('Número de mesas')}
            value={count}
            onChange={(event) => setCount(event.target.value)}
            slotProps={{ htmlInput: { min: 1, max: MAX_TABLES } }}
            sx={{ width: 160 }}
          />
          <Box>
            <Button variant="outlined" color="inherit" startIcon={<Printer size={15} />} onClick={print}>
              {t('Imprimir códigos QR de las mesas')}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('Cada código abre {url}', { url: tableUrl(catalogUrl, 1) })}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
