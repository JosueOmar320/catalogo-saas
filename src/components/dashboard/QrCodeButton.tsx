'use client';

import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { Download, Printer, QrCode } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '@/i18n/client';
import { trackedLink } from '@/lib/analytics/source';
import { qrMatrix, qrPath, qrSvg } from '@/lib/qr';
import { escapeHtml } from '@/lib/utils/text';

/** source: el código lleva ?ref=<source> para que la analítica cuente esas visitas como de QR (el texto visible sigue limpio). */
type Props = { url: string; businessName: string; slug: string; published: boolean; source?: string };

const MARGIN = 4;

function save(name: string, blob: Blob) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

/** Botón "Código QR" del catálogo: vista previa, descarga en PNG/SVG y cartel para imprimir. */
export function QrCodeButton({ url, businessName, slug, published, source = 'qr' }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const target = useMemo(() => trackedLink(url, source), [url, source]);
  const matrix = useMemo(() => (open ? qrMatrix(target) : null), [open, target]);
  const size = matrix ? matrix.length + MARGIN * 2 : 0;

  const downloadPng = () => {
    if (!matrix) return;
    // ~1000 px: nítido impreso a 8–10 cm.
    const scale = Math.max(8, Math.floor(1000 / size));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * scale;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    matrix.forEach((cells, row) => cells.forEach((dark, col) => dark && context.fillRect((col + MARGIN) * scale, (row + MARGIN) * scale, scale, scale)));
    canvas.toBlob((blob) => blob && save(`qr-${slug}.png`, blob), 'image/png');
  };

  const downloadSvg = () => save(`qr-${slug}.svg`, new Blob([qrSvg(target)], { type: 'image/svg+xml' }));

  const printPoster = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="${document.documentElement.lang}"><head><meta charset="utf-8"><title>${escapeHtml(businessName)}</title>
<style>@page{size:auto;margin:16mm}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;text-align:center;color:#111;margin:0;padding:24px}h1{font-size:34px;margin:0 0 8px}p{font-size:18px;margin:0 0 24px;color:#444}svg{width:min(80vw,110mm);height:auto}.url{margin-top:16px;font-size:14px;color:#555;word-break:break-all}</style></head>
<body><h1>${escapeHtml(businessName)}</h1><p>${escapeHtml(t('Escanea para ver nuestro catálogo'))}</p>${qrSvg(target)}<div class="url">${escapeHtml(url)}</div></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <>
      <Button variant="outlined" color="inherit" size="small" startIcon={<QrCode size={14} />} onClick={() => setOpen(true)}>
        {t('Código QR')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('Código QR de tu catálogo')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            {matrix && (
              <Box
                component="svg"
                viewBox={`0 0 ${size} ${size}`}
                shapeRendering="crispEdges"
                role="img"
                aria-label={t('Código QR que abre {url}', { url })}
                sx={{ width: 220, height: 220, borderRadius: 1, border: 1, borderColor: 'divider' }}
              >
                <rect width={size} height={size} fill="#ffffff" />
                <path d={qrPath(matrix, MARGIN)} fill="#000000" />
              </Box>
            )}
            <Typography variant="body2" sx={{ wordBreak: 'break-all', textAlign: 'center' }}>{url}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              {t('Imprímelo en tu menú, mostrador, empaques o volantes: al escanearlo se abre tu catálogo.')}
            </Typography>
            {!published && <Alert severity="warning" sx={{ width: '100%' }}>{t('Tu catálogo aún no está publicado: el código abrirá una página de "no disponible" hasta que lo publiques.')}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button startIcon={<Printer size={14} />} onClick={printPoster}>{t('Imprimir cartel')}</Button>
          <Button startIcon={<Download size={14} />} onClick={downloadSvg}>SVG</Button>
          <Button variant="contained" startIcon={<Download size={14} />} onClick={downloadPng}>PNG</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
