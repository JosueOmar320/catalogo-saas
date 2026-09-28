'use client';

import { Alert, Box, Button, ButtonBase, Chip, CircularProgress, Paper, Stack, Switch, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SortableList } from '@/components/ui/SortableList';
import { useToast } from '@/components/feedback/ToastProvider';
import { useAction } from '@/lib/hooks/use-action';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes';
import { PDF_TEMPLATE_META, PDF_TEMPLATES, TEMPLATE_DEFAULTS, type PdfContentBlock, type PdfSettings } from '@/lib/pdf/settings';
import {
  Advanced,
  BackgroundEditor,
  ColorInput,
  Group,
  MediaInput,
  Segmented,
  SliderInput,
  SwitchRow,
  TextInput,
} from '@/features/builder/components/controls';
import { savePdfSettings } from '../actions';

type Tab = 'template' | 'content' | 'cover' | 'page' | 'chrome' | 'products';
type Props = { catalogId: string; initial: PdfSettings; pages: { id: string; title: string }[]; enabled: boolean; itemCount: number };

const BLOCK_LABEL: Record<PdfContentBlock['type'], string> = { cover: 'Portada', catalog: 'Catálogo completo', page: 'Página', contact: 'Contacto' };

/** Estudio de PDF: configuración → vista previa real → descarga. */
export function PdfStudio({ catalogId, initial, pages, enabled, itemCount }: Props) {
  const [settings, setSettings] = useState<PdfSettings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>('template');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const toast = useToast();
  const { run, pending } = useAction();
  const wide = useMediaQuery(useTheme().breakpoints.up('lg'));
  const dirty = JSON.stringify(settings) !== saved;
  useUnsavedChangesWarning(dirty);

  const set = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const patch = <K extends 'cover' | 'header' | 'footer' | 'products'>(key: K, value: Partial<PdfSettings[K]>) => setSettings((s) => ({ ...s, [key]: { ...s[key], ...value } }));

  const request = useCallback(
    async (preview: boolean, signal?: AbortSignal) => {
      const response = await fetch(`/api/catalogs/${catalogId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, preview }),
        signal,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'No se pudo generar el PDF.');
      return response.blob();
    },
    [catalogId, settings],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError(null);
    try {
      const blob = await request(true, controller.signal);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      if (abort.current === controller) setLoading(false);
    }
  }, [enabled, request]);

  // Vista previa automática (con demora) al cambiar la configuración.
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 900);
    return () => clearTimeout(timer);
  }, [refresh]);

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await request(false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalogo.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  // Contenido: bloques guardados + páginas del sitio que aún no están (desactivadas).
  const blocks = useMemo(() => {
    const list = settings.content.filter((b) => b.type !== 'page' || pages.some((p) => p.id === b.pageId));
    for (const page of pages) {
      if (!list.some((b) => b.type === 'page' && b.pageId === page.id)) list.push({ id: `page-${page.id}`, type: 'page', pageId: page.id, enabled: false });
    }
    return list;
  }, [settings.content, pages]);
  const updateBlock = (id: string, patchBlock: Partial<PdfContentBlock>) => set('content', blocks.map((b) => (b.id === id ? { ...b, ...patchBlock } : b)));

  const panel = (
    <Paper variant="outlined" sx={{ px: 2, pb: 3, height: { lg: '100%' }, overflowY: { lg: 'auto' } }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
        <Tab value="template" label="Plantilla" />
        <Tab value="content" label="Contenido" />
        <Tab value="cover" label="Portada" />
        <Tab value="page" label="Página" />
        <Tab value="chrome" label="Encabezado y pie" />
        <Tab value="products" label="Productos" />
      </Tabs>

      {tab === 'template' && (
        <Group title="Plantilla" description="Cada plantilla es una composición distinta. Todas usan los colores, fuentes, logo y fondo de tu sitio.">
          {PDF_TEMPLATES.map((id) => (
            <ButtonBase
              key={id}
              onClick={() => setSettings((s) => ({ ...s, template: id, products: { ...s.products, ...TEMPLATE_DEFAULTS[id].products } }))}
              aria-pressed={settings.template === id}
              sx={{ display: 'block', textAlign: 'left', p: 1.25, borderRadius: 1.5, border: 1, borderColor: settings.template === id ? 'primary.main' : 'divider', boxShadow: settings.template === id ? (t) => `0 0 0 1px ${t.palette.primary.main}` : 'none' }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{PDF_TEMPLATE_META[id].label}</Typography>
              <Typography variant="caption" color="text.secondary">{PDF_TEMPLATE_META[id].description}</Typography>
            </ButtonBase>
          ))}
        </Group>
      )}

      {tab === 'content' && (
        <>
          <Group title="Qué incluir y en qué orden" description="Arrastra para ordenar. Las páginas del sitio se adaptan para impresión.">
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
              <SortableList
                items={blocks}
                getId={(b) => b.id}
                onReorder={(next) => set('content', next)}
                renderItem={(block) => (
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                    <FileText size={15} />
                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, color: block.enabled ? 'text.primary' : 'text.disabled' }} noWrap>
                      {block.type === 'page' ? `Página: ${pages.find((p) => p.id === block.pageId)?.title}` : BLOCK_LABEL[block.type]}
                    </Typography>
                    <Switch size="small" checked={block.enabled} onChange={(e) => updateBlock(block.id, { enabled: e.target.checked })} slotProps={{ input: { 'aria-label': 'Incluir' } }} />
                  </Stack>
                )}
              />
            </Box>
          </Group>
          <Group title="Catálogo completo">
            <Segmented label="Incluir" value={settings.catalogFilter} onChange={(v) => set('catalogFilter', v)} options={[{ value: 'all', label: 'Todo' }, { value: 'products', label: 'Productos' }, { value: 'services', label: 'Servicios' }]} />
            <SwitchRow label="Cada categoría en página nueva" checked={settings.products.pageBreakPerCategory} onChange={(pageBreakPerCategory) => patch('products', { pageBreakPerCategory })} />
          </Group>
        </>
      )}

      {tab === 'cover' && (
        <Group title="Portada" description="Actívala o desactívala en Contenido.">
          <TextInput label="Título" value={settings.cover.title} placeholder="Vacío = nombre del negocio" onChange={(title) => patch('cover', { title })} maxLength={120} />
          <TextInput label="Subtítulo" value={settings.cover.subtitle} placeholder="Vacío = slogan" onChange={(subtitle) => patch('cover', { subtitle })} maxLength={200} />
          <SwitchRow label="Logo" checked={settings.cover.showLogo} onChange={(showLogo) => patch('cover', { showLogo })} />
          <SwitchRow label="Descripción del negocio" checked={settings.cover.showDescription} onChange={(showDescription) => patch('cover', { showDescription })} />
          <SwitchRow label="Datos de contacto" checked={settings.cover.showContact} onChange={(showContact) => patch('cover', { showContact })} />
          <Segmented label="Imagen" value={settings.cover.imageSource} onChange={(imageSource) => patch('cover', { imageSource })} options={[{ value: 'cover', label: 'Del sitio' }, { value: 'custom', label: 'Otra' }, { value: 'none', label: 'Sin imagen' }]} />
          {settings.cover.imageSource === 'custom' && <MediaInput label="Imagen de portada" value={settings.cover.imagePath} onChange={(imagePath) => patch('cover', { imagePath })} />}
          <Advanced title="Fondo de la portada">
            <BackgroundEditor value={settings.cover.background} onChange={(background) => patch('cover', { background })} inheritLabel="Según plantilla" />
          </Advanced>
        </Group>
      )}

      {tab === 'page' && (
        <>
          <Group title="Formato">
            <Segmented label="Tamaño" value={settings.paperSize} onChange={(v) => set('paperSize', v)} options={[{ value: 'A4', label: 'A4' }, { value: 'LETTER', label: 'Carta' }, { value: 'A5', label: 'A5' }]} />
            <Segmented label="Orientación" value={settings.orientation} onChange={(v) => set('orientation', v)} options={[{ value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]} />
            <Segmented label="Márgenes" value={settings.margins} onChange={(v) => set('margins', v)} options={[{ value: 'small', label: 'Chicos' }, { value: 'medium', label: 'Medios' }, { value: 'large', label: 'Grandes' }, { value: 'custom', label: 'Otro' }]} />
            {settings.margins === 'custom' && <SliderInput label="Margen" value={settings.customMargin} min={5} max={40} format={(v) => `${v} mm`} onChange={(v) => set('customMargin', v)} />}
          </Group>
          <Group title="Fondo de las páginas" description="Heredado = el fondo global de tu sitio (color, imagen, patrón…).">
            <BackgroundEditor value={settings.background} onChange={(v) => set('background', v)} inheritLabel="Del sitio" />
            <SwitchRow label="Ahorro de tinta" description="Fondo blanco y colores legibles al imprimir." checked={settings.inkSaver} onChange={(v) => set('inkSaver', v)} />
          </Group>
        </>
      )}

      {tab === 'chrome' && (
        <>
          <Group title="Encabezado">
            <SwitchRow label="Mostrar encabezado" checked={settings.header.enabled} onChange={(enabled) => patch('header', { enabled })} />
            {settings.header.enabled && (
              <>
                <SwitchRow label="Logo" checked={settings.header.showLogo} onChange={(showLogo) => patch('header', { showLogo })} />
                <SwitchRow label="Nombre" checked={settings.header.showName} onChange={(showName) => patch('header', { showName })} />
                <SwitchRow label="Número de página" checked={settings.header.showPageNumber} onChange={(showPageNumber) => patch('header', { showPageNumber })} />
                <SwitchRow label="Línea separadora" checked={settings.header.separator} onChange={(separator) => patch('header', { separator })} />
                <TextInput label="Texto a la derecha" value={settings.header.text} placeholder="Ej. Catálogo 2026" onChange={(text) => patch('header', { text })} maxLength={80} />
                <ColorInput label="Color" value={settings.header.color || '#1A1A1A'} onChange={(color) => patch('header', { color })} />
                {settings.header.color && <Button size="small" color="inherit" onClick={() => patch('header', { color: '' })}>Usar color del tema</Button>}
              </>
            )}
          </Group>
          <Group title="Pie de página">
            <SwitchRow label="Mostrar pie de página" checked={settings.footer.enabled} onChange={(enabled) => patch('footer', { enabled })} />
            {settings.footer.enabled && (
              <>
                <Segmented label="Numeración" value={settings.footer.pageNumbers} onChange={(pageNumbers) => patch('footer', { pageNumbers })} options={[{ value: 'none', label: 'Sin' }, { value: 'simple', label: '3' }, { value: 'ofTotal', label: '3 / 12' }]} />
                <SwitchRow label="WhatsApp" checked={settings.footer.showWhatsapp} onChange={(showWhatsapp) => patch('footer', { showWhatsapp })} />
                <SwitchRow label="Teléfono" checked={settings.footer.showPhone} onChange={(showPhone) => patch('footer', { showPhone })} />
                <SwitchRow label="Email" checked={settings.footer.showEmail} onChange={(showEmail) => patch('footer', { showEmail })} />
                <SwitchRow label="Sitio web" checked={settings.footer.showWebsite} onChange={(showWebsite) => patch('footer', { showWebsite })} />
                <TextInput label="Texto personalizado" value={settings.footer.customText} placeholder="Ej. Precios válidos hasta agotar existencias" onChange={(customText) => patch('footer', { customText })} maxLength={160} />
              </>
            )}
          </Group>
        </>
      )}

      {tab === 'products' && (
        <Group title="Productos y servicios">
          <Segmented label="Columnas" value={settings.products.columns} onChange={(columns) => patch('products', { columns })} options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
          <Segmented label="Imagen" value={settings.products.imageSize} onChange={(imageSize) => patch('products', { imageSize })} options={[{ value: 'none', label: 'Sin' }, { value: 'sm', label: 'Chica' }, { value: 'md', label: 'Media' }, { value: 'lg', label: 'Grande' }]} />
          <SwitchRow label="Precio" checked={settings.products.showPrice} onChange={(showPrice) => patch('products', { showPrice })} />
          <SwitchRow label="Descripción" checked={settings.products.showDescription} onChange={(showDescription) => patch('products', { showDescription })} />
          <SwitchRow label="Badges" checked={settings.products.showBadges} onChange={(showBadges) => patch('products', { showBadges })} />
          <SwitchRow label="Categoría" checked={settings.products.showCategory} onChange={(showCategory) => patch('products', { showCategory })} />
          <SwitchRow label="Código / SKU" checked={settings.products.showSku} onChange={(showSku) => patch('products', { showSku })} />
        </Group>
      )}
    </Paper>
  );

  const preview = (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary">Vista previa</Typography>
        {itemCount > 60 && <Chip size="small" label="Muestra los primeros 60 ítems" />}
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" startIcon={loading ? <CircularProgress size={14} /> : <RefreshCw size={14} />} onClick={() => void refresh()} disabled={loading || !enabled}>
          Actualizar
        </Button>
      </Stack>
      <Box sx={{ position: 'relative', flex: 1, minHeight: { xs: '70vh', lg: 0 }, bgcolor: '#E9E9EE', borderRadius: 2, overflow: 'hidden' }}>
        {previewUrl && <Box component="iframe" src={`${previewUrl}#toolbar=0&view=FitH`} title="Vista previa del PDF" sx={{ width: '100%', height: '100%', border: 0 }} />}
        {(loading || !previewUrl) && (
          <Stack spacing={1} sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', bgcolor: previewUrl ? 'rgba(233,233,238,.6)' : 'transparent' }}>
            {enabled ? <CircularProgress size={28} /> : null}
            <Typography variant="body2" color="text.secondary">{enabled ? 'Generando vista previa…' : 'La exportación a PDF no está incluida en tu plan.'}</Typography>
          </Stack>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: { lg: 'calc(100vh - 56px - 32px)' } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h1">Catálogo en PDF</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>Configura, revisa la vista previa y descarga. Usa el diseño de tu sitio.</Typography>
        </Box>
        <Button color="inherit" onClick={() => run(() => savePdfSettings(settings), { onSuccess: () => setSaved(JSON.stringify(settings)) })} disabled={!dirty || pending}>
          Guardar configuración
        </Button>
        <Button variant="contained" startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <Download size={15} />} onClick={download} disabled={downloading || !enabled}>
          Descargar PDF
        </Button>
      </Stack>
      {wide ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '400px minmax(0, 1fr)', gap: 2, flex: 1, minHeight: 0 }}>
          {panel}
          {preview}
        </Box>
      ) : (
        <Stack spacing={2}>
          {preview}
          {panel}
        </Stack>
      )}
    </Box>
  );
}
