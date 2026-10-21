'use client';

import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { Copy, Download, Megaphone, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CopyField } from '@/components/ui/CopyField';
import { useT } from '@/i18n/client';
import { qrMatrix } from '@/lib/qr';
import { displayUrl, readableOn, shareMessages, wrapText } from '@/lib/share/kit';

type Props = { url: string; businessName: string; slogan: string | null; color: string; slug: string; published: boolean; /** Lista de precios en texto (en el idioma del sitio); sin ella (sitio web) no se ofrece. */ priceList?: string };

const W = 1080;
const H = 1920;

/**
 * "Kit para compartir": imagen para historias (1080×1920, con el nombre, el
 * enlace y el código QR, en el color del sitio) y mensajes listos para copiar.
 */
export function ShareKitButton({ url, businessName, slogan, color, slug, published, priceList }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [headline, setHeadline] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const messages = useMemo(() => shareMessages(t, businessName, url), [t, businessName, url]);
  const title = headline.trim() || t('Haz tu pedido por WhatsApp');
  const [copied, setCopied] = useState(false);
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(priceList ?? '');
      setCopied(true);
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    // El diálogo monta el canvas en el siguiente cuadro.
    const id = requestAnimationFrame(() => canvas.current && drawStory(canvas.current, { businessName, slogan, color, url, title, scanLabel: t('Escanea o entra a') }));
    return () => cancelAnimationFrame(id);
  }, [open, businessName, slogan, color, url, title, t]);

  const download = () =>
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `historia-${slug}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    }, 'image/png');

  return (
    <>
      <Button variant="outlined" color="inherit" startIcon={<Megaphone size={15} />} onClick={() => setOpen(true)}>
        {t('Kit para compartir')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth aria-labelledby="share-kit-title">
        <DialogTitle id="share-kit-title">{t('Kit para compartir tu catálogo')}</DialogTitle>
        <DialogContent dividers>
          {!published && <Alert severity="info" sx={{ mb: 2 }}>{t('Publica tu catálogo para que el enlace y el código funcionen.')}</Alert>}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Stack spacing={1.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Box
                component="canvas"
                ref={canvas}
                width={W}
                height={H}
                role="img"
                aria-label={t('Imagen para historias con el nombre de tu negocio, el enlace y el código QR')}
                sx={{ width: 220, height: 'auto', aspectRatio: '9 / 16', borderRadius: 2, boxShadow: 3, bgcolor: 'action.hover' }}
              />
              <TextField
                size="small"
                label={t('Texto principal')}
                placeholder={t('Haz tu pedido por WhatsApp')}
                value={headline}
                onChange={(event) => setHeadline(event.target.value.slice(0, 60))}
                sx={{ width: 240 }}
              />
              <Button variant="contained" startIcon={<Download size={15} />} onClick={download}>
                {t('Descargar imagen')}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 240, textAlign: 'center' }}>
                {t('Para historias de Instagram, Facebook o estados de WhatsApp (1080 × 1920).')}
              </Typography>
            </Stack>
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              {messages.map((message) => (
                <CopyField key={message.id} value={message.text} label={message.label} openable={false} />
              ))}
              <Box>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<MessageCircle size={15} />}
                  href={`https://wa.me/?text=${encodeURIComponent(messages[0].text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('Enviar por WhatsApp')}
                </Button>
              </Box>
              {priceList && (
              <>
              <TextField
                label={t('Lista de precios (para WhatsApp)')}
                value={priceList}
                multiline
                minRows={4}
                maxRows={10}
                slotProps={{ htmlInput: { readOnly: true } }}
                helperText={t('Por categoría, con lo visible y disponible. Los asteriscos se ven en negritas en WhatsApp.')}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" color="inherit" startIcon={<Copy size={15} />} onClick={() => void copyList()}>
                  {copied ? t('Lista copiada') : t('Copiar lista de precios')}
                </Button>
              </Stack>
              </>
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('Cerrar')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type Story = { businessName: string; slogan: string | null; color: string; url: string; title: string; scanLabel: string };

/** Dibuja la historia: fondo del color del sitio, título, nombre, tarjeta blanca con el QR y el enlace; todo centrado en vertical. */
function drawStory(canvas: HTMLCanvasElement, { businessName, slogan, color, url, title, scanLabel }: Story) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ink = readableOn(color);
  const font = (weight: number, size: number) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const measureWith = (f: string) => (value: string) => {
    ctx.font = f;
    return ctx.measureText(value).width;
  };
  const center = (text: string, y: number) => ctx.fillText(text, W / 2, y);

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Medidas primero, para centrar el bloque completo.
  const titleFont = font(800, 104);
  const nameFont = font(600, 56);
  const sloganFont = font(400, 40);
  const titleLines = wrapText(title, W - 160, measureWith(titleFont), 3);
  const nameLines = wrapText(businessName, W - 200, measureWith(nameFont), 2);
  const sloganLines = slogan ? wrapText(slogan, W - 220, measureWith(sloganFont), 2) : [];
  const card = 640;
  const cardH = card + 130;
  const textH = titleLines.length * 120 + 24 + nameLines.length * 70 + (sloganLines.length ? 10 + sloganLines.length * 54 : 0);
  const total = textH + 90 + cardH;
  let y = Math.max(140, (H - total) / 2) + 100;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;
  ctx.font = titleFont;
  titleLines.forEach((line) => {
    center(line, y);
    y += 120;
  });
  y += 24 - 120 + 70;
  ctx.globalAlpha = 0.9;
  ctx.font = nameFont;
  nameLines.forEach((line, i) => {
    center(line, y);
    if (i < nameLines.length - 1) y += 70;
  });
  if (sloganLines.length) {
    ctx.font = sloganFont;
    y += 64;
    sloganLines.forEach((line, i) => {
      center(line, y);
      if (i < sloganLines.length - 1) y += 54;
    });
  }
  ctx.globalAlpha = 1;

  // Tarjeta blanca con el QR (siempre negro sobre blanco: así lo leen todas las cámaras).
  const cardX = (W - card) / 2;
  const cardY = y + 90;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cardX, cardY, card, cardH, 48);
  ctx.fill();
  const matrix = qrMatrix(url);
  const cell = Math.floor((card - 120) / matrix.length);
  const qrSize = cell * matrix.length;
  const qrX = cardX + (card - qrSize) / 2;
  const qrY = cardY + 60;
  ctx.fillStyle = '#000000';
  matrix.forEach((cells, row) => cells.forEach((dark, col) => dark && ctx.fillRect(qrX + col * cell, qrY + row * cell, cell, cell)));
  ctx.fillStyle = '#444444';
  ctx.font = font(500, 34);
  center(scanLabel, qrY + qrSize + 70);
  // El enlace en una línea: se achica hasta que quepa en la tarjeta.
  const link = displayUrl(url);
  let size = 40;
  while (size > 22 && measureWith(font(700, size))(link) > card - 60) size -= 2;
  ctx.fillStyle = '#111111';
  ctx.font = font(700, size);
  center(wrapText(link, card - 60, measureWith(font(700, size)), 1)[0] ?? link, qrY + qrSize + 122);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Oscurece (negativo) o aclara un color hex. */
function shade(hex: string, amount: number) {
  const value = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(value.slice(i, i + 2), 16);
    const next = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.round(Math.min(255, Math.max(0, next))).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}
