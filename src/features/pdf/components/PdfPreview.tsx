'use client';

import { Box, ButtonBase, CircularProgress, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight, Maximize2, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Vista previa del PDF dibujada con pdf.js: página actual con zoom,
 * miniaturas de todas las páginas y a qué bloque pertenece cada una. Hacer
 * clic en una miniatura abre ese bloque en el panel.
 */

type Props = {
  blob: Blob | null;
  page: number;
  onPage: (page: number) => void;
  /** Etiqueta del bloque que empieza en cada página (o continúa). */
  pageLabel: (page: number) => string;
  onPageClick?: (page: number) => void;
  busy?: boolean;
};

type Zoom = 'fit' | 1 | 1.5;

let pdfjs: typeof import('pdfjs-dist') | null = null;
async function loadPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  }
  return pdfjs;
}

function PageCanvas({ pdf, number, width, className }: { pdf: PDFDocumentProxy; number: number; width: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void (async () => {
      // Si el documento se liberó (llegó un PDF nuevo), getPage falla: no es un error.
      const page = await pdf.getPage(number).catch(() => null);
      if (!page || cancelled || !ref.current) return;
      const base = page.getViewport({ scale: 1 });
      const ratio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      const canvas = ref.current;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      task = page.render({ canvas, viewport });
      await task.promise.catch(() => null);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, number, width]);
  return <canvas ref={ref} className={className} style={{ display: 'block', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.12)' }} />;
}

export function PdfPreview({ blob, page, onPage, pageLabel, onPageClick, busy }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [width, setWidth] = useState(600);
  const stage = useRef<HTMLDivElement>(null);

  // Cargar el documento cada vez que cambia el PDF generado.
  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    void (async () => {
      try {
        const lib = await loadPdfjs();
        const loaded = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled) return void loaded.loadingTask.destroy();
        setFailed(false);
        setPdf(loaded);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  // Libera el documento anterior (memoria del worker de pdf.js) al cambiar de PDF o al desmontar.
  useEffect(() => {
    return () => void pdf?.loadingTask.destroy();
  }, [pdf]);

  // Ancho disponible para "ajustar a la pantalla".
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(240, el.clientWidth - 48)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pages = pdf?.numPages ?? 0;
  const current = Math.min(Math.max(1, page), Math.max(1, pages));
  const pageWidth = zoom === 'fit' ? Math.min(width, 900) : Math.round(595 * zoom * 1.2);

  if (failed) {
    return (
      <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">No se pudo mostrar la vista previa. Descarga el PDF para verlo.</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '128px minmax(0, 1fr)' }, gridTemplateRows: { xs: 'auto minmax(0, 1fr)', md: 'minmax(0, 1fr)' }, gap: 1.5, height: '100%', minHeight: 0 }}>
      {/* Miniaturas */}
      <Box
        sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 1.25, overflow: 'auto', p: 0.5, pr: { md: 1 } }}
        role="listbox"
        aria-label="Páginas del PDF"
      >
        {pdf &&
          Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <ButtonBase
              key={n}
              role="option"
              aria-selected={n === current}
              onClick={() => {
                onPage(n);
                onPageClick?.(n);
              }}
              sx={{ flexDirection: 'column', alignItems: 'stretch', flex: 'none', width: { xs: 84, md: '100%' }, p: 0.5, borderRadius: 1, outline: n === current ? '2px solid' : 'none', outlineColor: 'primary.main', bgcolor: n === current ? 'action.selected' : 'transparent' }}
            >
              <PageCanvas pdf={pdf} number={n} width={104} />
              <Typography variant="caption" sx={{ mt: 0.5, fontWeight: 600, lineHeight: 1.2 }} noWrap>{n}. {pageLabel(n)}</Typography>
            </ButtonBase>
          ))}
      </Box>

      {/* Página actual */}
      <Stack sx={{ minHeight: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
          <IconButton size="small" onClick={() => onPage(Math.max(1, current - 1))} disabled={current <= 1} aria-label="Página anterior"><ChevronLeft size={16} /></IconButton>
          <Typography variant="body2" sx={{ minWidth: 74, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{pages ? `Pág. ${current} / ${pages}` : '—'}</Typography>
          <IconButton size="small" onClick={() => onPage(Math.min(pages, current + 1))} disabled={current >= pages} aria-label="Página siguiente"><ChevronRight size={16} /></IconButton>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>{pages ? pageLabel(current) : ''}</Typography>
          <ToggleButtonGroup size="small" exclusive value={zoom} onChange={(_, v: Zoom | null) => v && setZoom(v)} aria-label="Zoom">
            <Tooltip title="Ajustar"><ToggleButton value="fit" aria-label="Ajustar"><Maximize2 size={14} /></ToggleButton></Tooltip>
            <ToggleButton value={1} aria-label="100%">100%</ToggleButton>
            <Tooltip title="Acercar"><ToggleButton value={1.5} aria-label="150%"><ZoomIn size={14} /></ToggleButton></Tooltip>
          </ToggleButtonGroup>
        </Stack>
        <Box ref={stage} sx={(theme) => ({ position: 'relative', flex: 1, minHeight: { xs: '60vh', md: 0 }, overflow: 'auto', bgcolor: '#E9E9EE', ...theme.applyStyles('dark', { bgcolor: '#0A0B0E' }), borderRadius: 2, p: 3, display: 'flex', justifyContent: zoom === 'fit' ? 'center' : 'flex-start', alignItems: 'flex-start' })}>
          {pdf && pages > 0 && <PageCanvas key={`${current}-${pageWidth}`} pdf={pdf} number={current} width={pageWidth} />}
          {(busy || !pdf) && (
            <Stack spacing={1} sx={(theme) => ({ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', bgcolor: pdf ? 'rgba(233,233,238,.55)' : 'transparent', ...(pdf ? theme.applyStyles('dark', { bgcolor: 'rgba(10,11,14,.6)' }) : {}) })}>
              <CircularProgress size={26} />
              <Typography variant="body2" color="text.secondary">Generando vista previa…</Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
