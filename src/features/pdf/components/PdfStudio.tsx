'use client';

import { Alert, Autocomplete, Box, Button, ButtonBase, Chip, CircularProgress, IconButton, Menu, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileText,
  Grid3x3,
  Images,
  LayoutGrid,
  ListOrdered,
  Phone,
  Plus,
  RefreshCw,
  Scissors,
  Settings2,
  Table2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SortableList } from '@/components/ui/SortableList';
import { useToast } from '@/components/feedback/ToastProvider';
import { useAction } from '@/lib/hooks/use-action';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes';
import {
  applyTemplate,
  CATEGORY_STYLE_LABELS,
  CATEGORY_STYLES,
  COVER_LAYOUT_LABELS,
  COVER_LAYOUTS,
  createPdfBlock,
  DECORATION_LABELS,
  DECORATIONS,
  PDF_BLOCK_META,
  PDF_BLOCK_TYPES,
  PDF_TEMPLATE_META,
  PDF_TEMPLATES,
  type PdfBlock,
  type PdfBlockOf,
  type PdfBlockType,
  type PdfSettings,
} from '@/lib/pdf/settings';
import { SORT_LABELS, SORT_OPTIONS } from '@/lib/catalog/collections';
import type { SiteViewModel } from '@/lib/site/view-model';
import {
  Advanced,
  BackgroundEditor,
  ColorInput,
  Group,
  ListEditor,
  MediaInput,
  RichTextInput,
  Segmented,
  SelectInput,
  SliderInput,
  SwitchRow,
  TextInput,
} from '@/features/builder/components/controls';
import { CollectionEditor, PresentationEditor } from '@/features/builder/components/editors/presentation-editors';
import { savePdfSettings } from '../actions';

type TabId = 'template' | 'content' | 'cover' | 'page';
type Props = { catalogId: string; initial: PdfSettings; site: SiteViewModel; enabled: boolean };

const PREVIEW_MAX_ITEMS = 60;
const BLOCK_ICONS: Record<PdfBlockType, LucideIcon> = {
  cover: BookOpen,
  toc: ListOrdered,
  catalog: LayoutGrid,
  products: Grid3x3,
  comparison: Table2,
  text: FileText,
  gallery: Images,
  page: Columns3,
  contact: Phone,
  pageBreak: Scissors,
};

/**
 * Estudio de PDF: plantilla → bloques (portada, índice, catálogo, colecciones,
 * comparativa, información, galería, páginas del sitio, contacto) → vista
 * previa real con selector de página → descarga.
 */
export function PdfStudio({ catalogId, initial, site, enabled }: Props) {
  const [settings, setSettings] = useState<PdfSettings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<TabId>('content');
  const [selected, setSelected] = useState<string | null>(null);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<{ url: string; pages: number; marks: Record<string, number> } | null>(null);
  const [page, setPage] = useState(1);
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
  const patch = <K extends 'cover' | 'header' | 'footer' | 'decorations'>(key: K, value: Partial<PdfSettings[K]>) => setSettings((s) => ({ ...s, [key]: { ...s[key], ...value } }));
  const updateBlock = (id: string, next: PdfBlock) => setSettings((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === id ? next : b)) }));
  const removeBlock = (id: string) => setSettings((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) }));
  const addBlock = (type: PdfBlockType) => {
    const block = createPdfBlock(type, settings.template, type === 'page' && site.pages[0] ? { pageId: site.pages[0].id } : {});
    setSettings((s) => {
      // Portada e índice van al principio; lo demás antes del contacto.
      const blocks = [...s.blocks];
      const contact = blocks.findIndex((b) => b.type === 'contact');
      const at = type === 'cover' ? 0 : type === 'toc' ? (blocks[0]?.type === 'cover' ? 1 : 0) : contact >= 0 ? contact : blocks.length;
      blocks.splice(at, 0, block);
      return { ...s, blocks };
    });
    setSelected(block.id);
    setAddAnchor(null);
  };

  const request = useCallback(
    async (isPreview: boolean, signal?: AbortSignal) => {
      const response = await fetch(`/api/catalogs/${catalogId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, preview: isPreview }),
        signal,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'No se pudo generar el PDF.');
      let marks: Record<string, number> = {};
      try {
        marks = JSON.parse(response.headers.get('X-Pdf-Marks') ?? '{}');
      } catch {}
      return { blob: await response.blob(), pages: Number(response.headers.get('X-Pdf-Pages')) || 0, marks };
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
      const result = await request(true, controller.signal);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { url: URL.createObjectURL(result.blob), pages: result.pages, marks: result.marks };
      });
      setPage((p) => Math.min(p, Math.max(1, result.pages)));
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
      const { blob } = await request(false);
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

  const selectBlock = (id: string | null) => {
    setSelected(id);
    // Salta a la página del bloque en la vista previa.
    const target = id ? (id === settings.blocks.find((b) => b.type === 'cover')?.id ? 1 : preview?.marks[id]) : undefined;
    if (target) setPage(target);
  };

  const blockLabel = (b: PdfBlock) => {
    if (b.type === 'page') return `Página: ${site.pages.find((p) => p.id === b.pageId)?.title ?? '—'}`;
    const title = 'title' in b && b.title && b.type !== 'toc' && b.type !== 'contact' ? b.title : '';
    return title ? `${PDF_BLOCK_META[b.type].label} · ${title}` : PDF_BLOCK_META[b.type].label;
  };
  const current = settings.blocks.find((b) => b.id === selected) ?? null;

  const panel = (
    <Paper variant="outlined" sx={{ px: 2, pb: 3, height: { lg: '100%' }, overflowY: { lg: 'auto' } }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
        <Tab value="content" label="Contenido" />
        <Tab value="template" label="Plantilla" />
        <Tab value="cover" label="Portada" />
        <Tab value="page" label="Página y marco" />
      </Tabs>

      {tab === 'template' && (
        <Group title="Plantilla" description="Cada plantilla es una composición distinta (portada, encabezado, pie, decoración y cómo se muestran los productos). Después puedes cambiar cada parte.">
          {PDF_TEMPLATES.map((id) => (
            <ButtonBase
              key={id}
              onClick={() => setSettings((s) => applyTemplate(s, id))}
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
          <Group title="Páginas del catálogo" description="Arrastra para ordenar. Haz clic en un bloque para configurarlo y ver su página.">
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
              <SortableList
                items={settings.blocks}
                getId={(b) => b.id}
                onReorder={(blocks) => set('blocks', blocks)}
                renderItem={(block) => {
                  const Icon = BLOCK_ICONS[block.type];
                  const active = block.id === selected;
                  return (
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, bgcolor: active ? 'action.selected' : undefined, mx: -1, px: 1, borderRadius: 1 }}>
                      <ButtonBase onClick={() => selectBlock(active ? null : block.id)} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1, py: 0.5, borderRadius: 1 }}>
                        <Icon size={15} />
                        <Typography variant="body2" sx={{ fontWeight: 500, color: block.enabled ? 'text.primary' : 'text.disabled' }} noWrap>{blockLabel(block)}</Typography>
                        {preview?.marks[block.id] && <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>p. {preview.marks[block.id]}</Typography>}
                      </ButtonBase>
                      <Switch size="small" checked={block.enabled} onChange={(e) => updateBlock(block.id, { ...block, enabled: e.target.checked })} slotProps={{ input: { 'aria-label': 'Incluir' } }} />
                    </Stack>
                  );
                }}
              />
            </Box>
            <Button startIcon={<Plus size={16} />} onClick={(e) => setAddAnchor(e.currentTarget)} sx={{ alignSelf: 'flex-start' }}>Agregar bloque</Button>
            <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
              {PDF_BLOCK_TYPES.filter((type) => (type !== 'cover' && type !== 'toc') || !settings.blocks.some((b) => b.type === type)).map((type) => {
                const Icon = BLOCK_ICONS[type];
                return (
                  <MenuItem key={type} onClick={() => addBlock(type)} disabled={type === 'page' && site.pages.length === 0} sx={{ gap: 1.25, alignItems: 'flex-start', maxWidth: 340, whiteSpace: 'normal' }}>
                    <Box sx={{ mt: 0.25 }}><Icon size={16} /></Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{PDF_BLOCK_META[type].label}</Typography>
                      <Typography variant="caption" color="text.secondary">{PDF_BLOCK_META[type].description}</Typography>
                    </Box>
                  </MenuItem>
                );
              })}
            </Menu>
          </Group>
          {current && (
            <Box sx={{ mt: 1, border: 1, borderColor: 'primary.main', borderRadius: 1.5, px: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: 'center', pt: 1.5 }}>
                <Settings2 size={16} />
                <Typography variant="h4" sx={{ ml: 1, flex: 1 }}>{PDF_BLOCK_META[current.type].label}</Typography>
                <Tooltip title="Quitar bloque">
                  <IconButton size="small" onClick={() => { removeBlock(current.id); setSelected(null); }}><Trash2 size={16} /></IconButton>
                </Tooltip>
              </Stack>
              <BlockEditor block={current} onChange={(next) => updateBlock(current.id, next)} site={site} onCoverTab={() => setTab('cover')} />
            </Box>
          )}
        </>
      )}

      {tab === 'cover' && <CoverEditor settings={settings} patch={(v) => patch('cover', v)} />}

      {tab === 'page' && (
        <>
          <Group title="Formato">
            <Segmented label="Tamaño" value={settings.paperSize} onChange={(v) => set('paperSize', v)} options={[{ value: 'A4', label: 'A4' }, { value: 'LETTER', label: 'Carta' }, { value: 'A5', label: 'A5' }]} />
            <Segmented label="Orientación" value={settings.orientation} onChange={(v) => set('orientation', v)} options={[{ value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]} />
            <Segmented label="Márgenes" value={settings.margins} onChange={(v) => set('margins', v)} options={[{ value: 'small', label: 'Chicos' }, { value: 'medium', label: 'Medios' }, { value: 'large', label: 'Grandes' }, { value: 'custom', label: 'Otro' }]} />
            {settings.margins === 'custom' && <SliderInput label="Margen" value={settings.customMargin} min={5} max={40} format={(v) => `${v} mm`} onChange={(v) => set('customMargin', v)} />}
          </Group>
          <Group title="Encabezado">
            <SelectInput label="Estilo" value={settings.header.style} onChange={(style) => patch('header', { style })} options={[{ value: 'none', label: 'Sin encabezado' }, { value: 'line', label: 'Logo y línea' }, { value: 'title', label: 'Título centrado entre líneas' }, { value: 'band', label: 'Banda de color' }]} />
            {settings.header.style !== 'none' && (
              <>
                <SwitchRow label="Logo" checked={settings.header.showLogo} onChange={(showLogo) => patch('header', { showLogo })} />
                <SwitchRow label="Nombre del negocio" checked={settings.header.showName} onChange={(showName) => patch('header', { showName })} />
                <SwitchRow label="Número de página" checked={settings.header.showPageNumber} onChange={(showPageNumber) => patch('header', { showPageNumber })} />
                <TextInput label="Texto" value={settings.header.text} placeholder="Ej. Catálogo de servicios 2026" onChange={(text) => patch('header', { text })} maxLength={80} />
                <ColorInput label="Color" value={settings.header.color || '#1A1A1A'} onChange={(color) => patch('header', { color })} />
                {settings.header.color && <Button size="small" color="inherit" onClick={() => patch('header', { color: '' })}>Usar color del tema</Button>}
              </>
            )}
          </Group>
          <Group title="Pie de página">
            <SelectInput label="Estilo" value={settings.footer.style} onChange={(style) => patch('footer', { style })} options={[{ value: 'none', label: 'Sin pie' }, { value: 'line', label: 'Línea fina' }, { value: 'band', label: 'Banda de color' }]} />
            {settings.footer.style !== 'none' && (
              <>
                <Segmented label="Numeración" value={settings.footer.pageNumbers} onChange={(pageNumbers) => patch('footer', { pageNumbers })} options={[{ value: 'none', label: 'Sin' }, { value: 'simple', label: '3' }, { value: 'ofTotal', label: '3 / 12' }]} />
                <SwitchRow label="Usuario de redes (@)" checked={settings.footer.showSocial} onChange={(showSocial) => patch('footer', { showSocial })} />
                <SwitchRow label="WhatsApp" checked={settings.footer.showWhatsapp} onChange={(showWhatsapp) => patch('footer', { showWhatsapp })} />
                <SwitchRow label="Teléfono" checked={settings.footer.showPhone} onChange={(showPhone) => patch('footer', { showPhone })} />
                <SwitchRow label="Email" checked={settings.footer.showEmail} onChange={(showEmail) => patch('footer', { showEmail })} />
                <SwitchRow label="Sitio web" checked={settings.footer.showWebsite} onChange={(showWebsite) => patch('footer', { showWebsite })} />
                <TextInput label="Texto personalizado" value={settings.footer.customText} placeholder="Ej. Precios válidos hasta agotar existencias" onChange={(customText) => patch('footer', { customText })} maxLength={160} />
              </>
            )}
          </Group>
          <Group title="Decoración" description="Formas genéricas en las esquinas, destellos y marco. Usan el color de acento.">
            <SelectInput label="Esquinas" value={settings.decorations.corners} onChange={(corners) => patch('decorations', { corners })} options={DECORATIONS.map((d) => ({ value: d, label: DECORATION_LABELS[d] }))} />
            <SwitchRow label="Destellos" checked={settings.decorations.sparkles} onChange={(sparkles) => patch('decorations', { sparkles })} />
            <SwitchRow label="Marco de página" checked={settings.decorations.frame} onChange={(frame) => patch('decorations', { frame })} />
            <ColorInput label="Color" value={settings.decorations.color || '#C8A96A'} onChange={(color) => patch('decorations', { color })} />
            {settings.decorations.color && <Button size="small" color="inherit" onClick={() => patch('decorations', { color: '' })}>Usar color de acento</Button>}
          </Group>
          <Group title="Fondo de las páginas" description="Heredado = el fondo global de tu sitio (color, imagen, patrón…).">
            <BackgroundEditor value={settings.background} onChange={(v) => set('background', v)} inheritLabel="Del sitio" />
            <SwitchRow label="Ahorro de tinta" description="Fondo blanco, sin decoración y colores legibles al imprimir." checked={settings.inkSaver} onChange={(v) => set('inkSaver', v)} />
          </Group>
        </>
      )}
    </Paper>
  );

  const pages = preview?.pages ?? 0;
  const previewPane = (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary">Vista previa</Typography>
        {site.items.length > PREVIEW_MAX_ITEMS && <Chip size="small" label={`Muestra los primeros ${PREVIEW_MAX_ITEMS} ítems`} />}
        <Box sx={{ flex: 1 }} />
        {pages > 0 && (
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Página anterior"><ChevronLeft size={16} /></IconButton>
            <Typography variant="body2" sx={{ minWidth: 72, textAlign: 'center' }}>Pág. {page} / {pages}</Typography>
            <IconButton size="small" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Página siguiente"><ChevronRight size={16} /></IconButton>
          </Stack>
        )}
        <Button color="inherit" startIcon={loading ? <CircularProgress size={14} /> : <RefreshCw size={14} />} onClick={() => void refresh()} disabled={loading || !enabled}>
          Actualizar
        </Button>
      </Stack>
      <Box sx={{ position: 'relative', flex: 1, minHeight: { xs: '70vh', lg: 0 }, bgcolor: '#E9E9EE', borderRadius: 2, overflow: 'hidden' }}>
        {/* key: al cambiar de página se vuelve a montar el visor en esa página. */}
        {preview && <Box key={`${preview.url}-${page}`} component="iframe" src={`${preview.url}#page=${page}&toolbar=0&view=FitH`} title="Vista previa del PDF" sx={{ width: '100%', height: '100%', border: 0 }} />}
        {(loading || !preview) && (
          <Stack spacing={1} sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', bgcolor: preview ? 'rgba(233,233,238,.6)' : 'transparent' }}>
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
          <Typography variant="body2" color="text.secondary" noWrap>
            {pages > 0 ? `${pages} páginas · ` : ''}Arma tu catálogo por bloques. Usa el diseño, los productos y las páginas de tu sitio.
          </Typography>
        </Box>
        <Button color="inherit" onClick={() => run(() => savePdfSettings(settings), { onSuccess: () => setSaved(JSON.stringify(settings)) })} disabled={!dirty || pending}>
          Guardar configuración
        </Button>
        <Button variant="contained" startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <Download size={15} />} onClick={download} disabled={downloading || !enabled}>
          Descargar PDF
        </Button>
      </Stack>
      {wide ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: 2, flex: 1, minHeight: 0 }}>
          {panel}
          {previewPane}
        </Box>
      ) : (
        <Stack spacing={2}>
          {previewPane}
          {panel}
        </Stack>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------ Portada */

function CoverEditor({ settings, patch }: { settings: PdfSettings; patch: (value: Partial<PdfSettings['cover']>) => void }) {
  const c = settings.cover;
  return (
    <>
      <Group title="Composición" description="Actívala o desactívala en Contenido.">
        <SelectInput label="Diseño de portada" value={c.layout} onChange={(layout) => patch({ layout })} options={COVER_LAYOUTS.map((l) => ({ value: l, label: COVER_LAYOUT_LABELS[l] }))} />
        {c.layout !== 'split' && c.layout !== 'band' && c.layout !== 'framed' && c.layout !== 'centered' && <Segmented label="Alineación" value={c.align} onChange={(align) => patch({ align })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />}
        <Segmented label="Tamaño del título" value={c.titleSize} onChange={(titleSize) => patch({ titleSize })} options={[{ value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
        <Segmented label="Color del texto" value={c.textColor} onChange={(textColor) => patch({ textColor })} options={[{ value: 'auto', label: 'Auto' }, { value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]} />
      </Group>
      <Group title="Textos">
        <TextInput label="Antetítulo" value={c.eyebrow} placeholder="Ej. CATÁLOGO" onChange={(eyebrow) => patch({ eyebrow })} maxLength={80} />
        <TextInput label="Título" value={c.title} placeholder="Vacío = nombre del negocio" onChange={(title) => patch({ title })} maxLength={120} />
        <TextInput label="Subtítulo" value={c.subtitle} placeholder="Vacío = slogan" onChange={(subtitle) => patch({ subtitle })} maxLength={200} />
        <Stack direction="row" spacing={1}>
          <TextInput label="Fecha / temporada" value={c.date} placeholder="Primavera 2026" onChange={(date) => patch({ date })} maxLength={40} />
          <TextInput label="Versión" value={c.version} placeholder="Edición 3" onChange={(version) => patch({ version })} maxLength={40} />
        </Stack>
        <TextInput label="Texto adicional" value={c.extraText} onChange={(extraText) => patch({ extraText })} multiline rows={2} maxLength={400} />
        <SwitchRow label="Logo" checked={c.showLogo} onChange={(showLogo) => patch({ showLogo })} />
        <SwitchRow label="Descripción del negocio" checked={c.showDescription} onChange={(showDescription) => patch({ showDescription })} />
        <SwitchRow label="Datos de contacto" checked={c.showContact} onChange={(showContact) => patch({ showContact })} />
      </Group>
      <Group title="Imagen">
        <Segmented label="Imagen" value={c.imageSource} onChange={(imageSource) => patch({ imageSource })} options={[{ value: 'cover', label: 'Del sitio' }, { value: 'custom', label: 'Otra' }, { value: 'none', label: 'Sin imagen' }]} />
        {c.imageSource === 'custom' && <MediaInput label="Imagen de portada" value={c.imagePath} onChange={(imagePath) => patch({ imagePath })} />}
        {(c.layout === 'band' || c.layout === 'centered') && c.imageSource !== 'none' && (
          <Segmented label="Forma" value={c.imageShape} onChange={(imageShape) => patch({ imageShape })} options={[{ value: 'rect', label: 'Recta' }, { value: 'rounded', label: 'Redond.' }, { value: 'circle', label: 'Círculo' }, { value: 'arch', label: 'Arco' }]} />
        )}
      </Group>
      <Group title="Decoración">
        <SelectInput label="Formas en las esquinas" value={c.decoration} onChange={(decoration) => patch({ decoration })} options={DECORATIONS.map((d) => ({ value: d, label: DECORATION_LABELS[d] }))} />
        <SwitchRow label="Destellos" checked={c.sparkles} onChange={(sparkles) => patch({ sparkles })} />
      </Group>
      <Advanced title="Fondo y overlay de la portada">
        <BackgroundEditor value={c.background} onChange={(background) => patch({ background })} inheritLabel="Color del papel" />
      </Advanced>
    </>
  );
}

/* ------------------------------------------------------------ Bloques */

function BlockEditor({ block, onChange, site, onCoverTab }: { block: PdfBlock; onChange: (block: PdfBlock) => void; site: SiteViewModel; onCoverTab: () => void }) {
  // Cada rama conoce el tipo exacto del bloque.
  const set = <T extends PdfBlockType>(b: PdfBlockOf<T>, value: Partial<PdfBlockOf<T>>) => onChange({ ...b, ...value } as PdfBlock);
  const newPage = block.type !== 'cover' && block.type !== 'pageBreak' && <SwitchRow label="Empieza en página nueva" checked={block.newPage} onChange={(newPage) => onChange({ ...block, newPage })} />;
  const heading = (b: { title: string; subtitle: string }, update: (v: { title?: string; subtitle?: string }) => void) => (
    <>
      <TextInput label="Título" value={b.title} onChange={(title) => update({ title })} maxLength={120} />
      <TextInput label="Subtítulo" value={b.subtitle} onChange={(subtitle) => update({ subtitle })} multiline rows={2} maxLength={240} />
    </>
  );
  const perPage = (value: number, update: (n: number) => void) => (
    <SliderInput label="Ítems por página" value={value} min={0} max={24} format={(v) => (v === 0 ? 'Automático' : String(v))} onChange={update} />
  );

  switch (block.type) {
    case 'cover':
      return (
        <Group description="La portada se diseña en su propia pestaña.">
          <Button onClick={onCoverTab} sx={{ alignSelf: 'flex-start' }}>Editar portada</Button>
        </Group>
      );
    case 'pageBreak':
      return <Group description="Lo que sigue empieza en una página nueva.">{null}</Group>;
    case 'toc':
      return (
        <Group>
          <TextInput label="Título" value={block.title} onChange={(title) => set(block, { title })} maxLength={80} />
          <SwitchRow label="Incluir categorías" checked={block.showCategories} onChange={(showCategories) => set(block, { showCategories })} />
          {newPage}
        </Group>
      );
    case 'catalog':
      return (
        <>
          <Group>
            {heading(block, (v) => set(block, v))}
            <Segmented label="Incluir" value={block.itemType} onChange={(itemType) => set(block, { itemType })} options={[{ value: 'any', label: 'Todo' }, { value: 'product', label: 'Productos' }, { value: 'service', label: 'Servicios' }]} />
            <Autocomplete
              multiple
              options={site.categories.map((c) => c.id)}
              value={block.categoryIds.filter((id) => site.categories.some((c) => c.id === id))}
              getOptionLabel={(id) => site.categories.find((c) => c.id === id)?.name ?? id}
              onChange={(_, categoryIds) => set(block, { categoryIds })}
              renderInput={(params) => <TextField {...params} label="Categorías (en este orden)" placeholder={block.categoryIds.length ? '' : 'Todas'} />}
            />
            <SelectInput label="Orden de los ítems" value={block.sort} onChange={(sort) => set(block, { sort })} options={SORT_OPTIONS.map((s) => ({ value: s, label: SORT_LABELS[s] }))} />
          </Group>
          <Group title="Categorías">
            <SelectInput label="Presentación de cada categoría" value={block.categoryStyle} onChange={(categoryStyle) => set(block, { categoryStyle })} options={CATEGORY_STYLES.map((s) => ({ value: s, label: CATEGORY_STYLE_LABELS[s] }))} />
            {block.categoryStyle !== 'hero' && <SwitchRow label="Cada categoría en página nueva" checked={block.categoryNewPage} onChange={(categoryNewPage) => set(block, { categoryNewPage })} />}
            {perPage(block.itemsPerPage, (itemsPerPage) => set(block, { itemsPerPage }))}
            {newPage}
          </Group>
          <PresentationEditor value={block.presentation} onChange={(presentation) => set(block, { presentation })} target="pdf" />
        </>
      );
    case 'products':
      return (
        <>
          <Group>
            {heading(block, (v) => set(block, v))}
            {perPage(block.itemsPerPage, (itemsPerPage) => set(block, { itemsPerPage }))}
            {newPage}
          </Group>
          <CollectionEditor value={block.collection} onChange={(collection) => set(block, { collection })} site={site} />
          <PresentationEditor value={block.presentation} onChange={(presentation) => set(block, { presentation })} target="pdf" />
        </>
      );
    case 'comparison':
      return (
        <>
          <Group>
            {heading(block, (v) => set(block, v))}
            <Autocomplete
              multiple
              options={site.attributeDefs.map((d) => d.id)}
              value={block.attributeIds.filter((id) => site.attributeDefs.some((d) => d.id === id))}
              getOptionLabel={(id) => site.attributeDefs.find((d) => d.id === id)?.name ?? id}
              onChange={(_, attributeIds) => set(block, { attributeIds })}
              renderInput={(params) => <TextField {...params} label="Atributos a comparar" placeholder={block.attributeIds.length ? '' : 'Todos los visibles en PDF'} />}
            />
            <SwitchRow label="Imagen" checked={block.showImage} onChange={(showImage) => set(block, { showImage })} />
            <SwitchRow label="Precio" checked={block.showPrice} onChange={(showPrice) => set(block, { showPrice })} />
            <SwitchRow label="Código" checked={block.showSku} onChange={(showSku) => set(block, { showSku })} />
            {newPage}
          </Group>
          <CollectionEditor value={block.collection} onChange={(collection) => set(block, { collection })} site={site} title="Qué comparar" />
        </>
      );
    case 'text':
      return (
        <Group>
          {heading(block, (v) => set(block, v))}
          <RichTextInput label="Texto" value={block.body} onChange={(body) => set(block, { body })} />
          <MediaInput label="Imagen (opcional)" value={block.imagePath} onChange={(imagePath) => set(block, { imagePath })} />
          {block.imagePath && <Segmented label="Imagen" value={block.imagePosition} onChange={(imagePosition) => set(block, { imagePosition })} options={[{ value: 'top', label: 'Arriba' }, { value: 'left', label: 'Izq.' }, { value: 'right', label: 'Der.' }, { value: 'bottom', label: 'Abajo' }]} />}
          {newPage}
        </Group>
      );
    case 'gallery':
      return (
        <>
          <Group>
            {heading(block, (v) => set(block, v))}
            <Segmented label="Fotos" value={block.source} onChange={(source) => set(block, { source })} options={[{ value: 'items', label: 'De mis ítems' }, { value: 'custom', label: 'Propias' }]} />
            <Segmented label="Forma" value={block.shape} onChange={(shape) => set(block, { shape })} options={[{ value: 'rect', label: 'Recta' }, { value: 'rounded', label: 'Redond.' }, { value: 'circle', label: 'Círculo' }, { value: 'hexagon', label: 'Hexágono' }]} />
            <SliderInput label="Columnas" value={block.columns} min={2} max={5} onChange={(columns) => set(block, { columns })} />
            <SwitchRow label="Leyendas" checked={block.captions} onChange={(captions) => set(block, { captions })} />
            {newPage}
          </Group>
          {block.source === 'items' ? (
            <CollectionEditor value={block.collection} onChange={(collection) => set(block, { collection })} site={site} />
          ) : (
            <Group title="Imágenes">
              <ListEditor
                items={block.images}
                onChange={(images) => set(block, { images })}
                create={() => ({ path: '', caption: '' })}
                addLabel="Agregar imagen"
                max={40}
                itemTitle={(img, i) => img.caption || `Imagen ${i + 1}`}
                renderItem={(img, update) => (
                  <>
                    <MediaInput label="Imagen" value={img.path || null} onChange={(path) => update({ ...img, path: path ?? '' })} width={96} />
                    <TextInput label="Leyenda" value={img.caption} onChange={(caption) => update({ ...img, caption })} maxLength={120} />
                  </>
                )}
              />
            </Group>
          )}
        </>
      );
    case 'page':
      return (
        <Group description="Las secciones de la página (texto, galería, beneficios, testimonios…) se adaptan para impresión.">
          <SelectInput label="Página del sitio" value={block.pageId} onChange={(pageId) => set(block, { pageId })} options={[{ value: '', label: 'Elige una página' }, ...site.pages.map((p) => ({ value: p.id, label: p.title }))]} />
          {newPage}
        </Group>
      );
    case 'contact':
      return (
        <Group description="Los datos salen de Configuración › Información de contacto.">
          {heading(block, (v) => set(block, v))}
          <RichTextInput label="Notas (formas de pago, políticas, garantía…)" value={block.notes} onChange={(notes) => set(block, { notes })} />
          <SwitchRow label="Redes sociales" checked={block.showSocial} onChange={(showSocial) => set(block, { showSocial })} />
          {newPage}
        </Group>
      );
  }
}
