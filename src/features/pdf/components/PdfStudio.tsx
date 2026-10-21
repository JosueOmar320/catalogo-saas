'use client';

import { Alert, Autocomplete, Box, Button, ButtonBase, Chip, CircularProgress, IconButton, Menu, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import {
  BadgePercent,
  BookMarked,
  BookOpen,
  Image as ImageIcon,
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
import { useT } from '@/i18n/client';
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
  PDF_DENSITIES,
  PDF_DENSITY_LABELS,
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
import { GarfieldLauncher, GarfieldPanel } from '@/features/assistant/components/GarfieldPanel';
import { PdfGarfieldProvider } from '@/features/assistant/components/PdfGarfieldProvider';
import { FONT_IDS, FONTS } from '@/lib/design/fonts';
import { PdfPreview } from './PdfPreview';
import { savePdfSettings } from '../actions';

type TabId = 'template' | 'content' | 'cover' | 'style' | 'page';
type Props = { catalogId: string; initial: PdfSettings; site: SiteViewModel; enabled: boolean; canManage?: boolean };

const PREVIEW_MAX_ITEMS = 60;
const BLOCK_ICONS: Record<PdfBlockType, LucideIcon> = {
  cover: BookOpen,
  toc: ListOrdered,
  catalog: LayoutGrid,
  products: Grid3x3,
  comparison: Table2,
  text: FileText,
  gallery: Images,
  image: ImageIcon,
  promo: BadgePercent,
  page: Columns3,
  contact: Phone,
  backCover: BookMarked,
  pageBreak: Scissors,
};

/**
 * Estudio de PDF: plantilla → bloques (portada, índice, catálogo, colecciones,
 * comparativa, información, galería, páginas del sitio, contacto) → vista
 * previa real con selector de página → descarga.
 */
export function PdfStudio({ catalogId, initial, site, enabled, canManage = true }: Props) {
  const t = useT();
  const [settings, setSettings] = useState<PdfSettings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<TabId>('content');
  const [selected, setSelected] = useState<string | null>(null);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; pages: number; marks: Record<string, number> } | null>(null);
  // Propuesta de Garfield en vista previa: se genera el PDF con ella sin tocar el borrador.
  const [proposal, setProposal] = useState<PdfSettings | null>(null);
  const shown = proposal ?? settings;
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  // Al salir del estudio se cancela la vista previa en curso (el servidor deja de generar un PDF que nadie verá).
  useEffect(() => () => abort.current?.abort(), []);
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
        body: JSON.stringify({ settings: isPreview ? shown : settings, preview: isPreview }),
        signal,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? t('No se pudo generar el PDF.'));
      let marks: Record<string, number> = {};
      try {
        marks = JSON.parse(response.headers.get('X-Pdf-Marks') ?? '{}');
      } catch {}
      return { blob: await response.blob(), pages: Number(response.headers.get('X-Pdf-Pages')) || 0, marks };
    },
    [catalogId, settings, shown, t],
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
      setPreview({ blob: result.blob, pages: result.pages, marks: result.marks });
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

  /** Bloque al que pertenece una página de la vista previa (el último que empezó en o antes de ella). */
  const blockAtPage = (n: number): PdfBlock | null => {
    const cover = shown.blocks.find((b) => b.type === 'cover' && b.enabled);
    if (n === 1 && cover) return cover;
    let best: { block: PdfBlock; page: number } | null = null;
    for (const block of shown.blocks) {
      const start = preview?.marks[block.id];
      if (start && start <= n && (!best || start >= best.page)) best = { block, page: start };
    }
    return best?.block ?? null;
  };

  const blockLabel = (b: PdfBlock) => {
    if (b.type === 'page') return t('Página: {title}', { title: site.pages.find((p) => p.id === b.pageId)?.title ?? '—' });
    const title = 'title' in b && b.title && b.type !== 'toc' && b.type !== 'contact' ? b.title : '';
    return title ? `${t(PDF_BLOCK_META[b.type].label)} · ${title}` : t(PDF_BLOCK_META[b.type].label);
  };
  const current = settings.blocks.find((b) => b.id === selected) ?? null;

  const panel = (
    <Paper variant="outlined" sx={{ px: 2, pb: 3, height: { lg: '100%' }, overflowY: { lg: 'auto' } }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
        <Tab value="content" label={t('Contenido')} />
        <Tab value="template" label={t('Plantilla')} />
        <Tab value="cover" label={t('Portada')} />
        <Tab value="style" label={t('Estilo')} />
        <Tab value="page" label={t('Página y marco')} />
      </Tabs>

      {tab === 'template' && (
        <Group title={t('Plantilla')} description={t('Cada plantilla es una composición distinta (portada, encabezado, pie, decoración y cómo se muestran los productos). Después puedes cambiar cada parte.')}>
          {PDF_TEMPLATES.map((id) => (
            <ButtonBase
              key={id}
              onClick={() => setSettings((s) => applyTemplate(s, id))}
              aria-pressed={settings.template === id}
              sx={{ display: 'block', textAlign: 'left', p: 1.25, borderRadius: 1.5, border: 1, borderColor: settings.template === id ? 'primary.main' : 'divider', boxShadow: settings.template === id ? (theme) => `0 0 0 1px ${theme.palette.primary.main}` : 'none' }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(PDF_TEMPLATE_META[id].label)}</Typography>
              <Typography variant="caption" color="text.secondary">{t(PDF_TEMPLATE_META[id].description)}</Typography>
            </ButtonBase>
          ))}
        </Group>
      )}

      {tab === 'content' && (
        <>
          <Group title={t('Páginas del catálogo')} description={t('Arrastra para ordenar. Haz clic en un bloque para configurarlo y ver su página.')}>
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
                        {preview?.marks[block.id] && <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{t('p. {page}', { page: preview.marks[block.id] })}</Typography>}
                      </ButtonBase>
                      <Switch size="small" checked={block.enabled} onChange={(e) => updateBlock(block.id, { ...block, enabled: e.target.checked })} slotProps={{ input: { 'aria-label': t('Incluir') } }} />
                    </Stack>
                  );
                }}
              />
            </Box>
            <Button startIcon={<Plus size={16} />} onClick={(e) => setAddAnchor(e.currentTarget)} sx={{ alignSelf: 'flex-start' }}>{t('Agregar bloque')}</Button>
            <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
              {PDF_BLOCK_TYPES.filter((type) => (type !== 'cover' && type !== 'toc') || !settings.blocks.some((b) => b.type === type)).map((type) => {
                const Icon = BLOCK_ICONS[type];
                return (
                  <MenuItem key={type} onClick={() => addBlock(type)} disabled={type === 'page' && site.pages.length === 0} sx={{ gap: 1.25, alignItems: 'flex-start', maxWidth: 340, whiteSpace: 'normal' }}>
                    <Box sx={{ mt: 0.25 }}><Icon size={16} /></Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(PDF_BLOCK_META[type].label)}</Typography>
                      <Typography variant="caption" color="text.secondary">{t(PDF_BLOCK_META[type].description)}</Typography>
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
                <Typography variant="h4" sx={{ ml: 1, flex: 1 }}>{t(PDF_BLOCK_META[current.type].label)}</Typography>
                <Tooltip title={t('Quitar bloque')}>
                  <IconButton size="small" aria-label={t('Quitar bloque')} onClick={() => { removeBlock(current.id); setSelected(null); }}><Trash2 size={16} /></IconButton>
                </Tooltip>
              </Stack>
              <BlockEditor block={current} onChange={(next) => updateBlock(current.id, next)} site={site} onCoverTab={() => setTab('cover')} />
            </Box>
          )}
        </>
      )}

      {tab === 'cover' && <CoverEditor settings={settings} patch={(v) => patch('cover', v)} />}

      {tab === 'style' && <PdfStyleEditor value={settings.style} onChange={(style) => set('style', style)} />}

      {tab === 'page' && (
        <>
          <Group title={t('Formato')}>
            <Segmented label={t('Tamaño')} value={settings.paperSize} onChange={(v) => set('paperSize', v)} options={[{ value: 'A4', label: 'A4' }, { value: 'LETTER', label: t('Carta') }, { value: 'A5', label: 'A5' }]} />
            <Segmented label={t('Orientación')} value={settings.orientation} onChange={(v) => set('orientation', v)} options={[{ value: 'portrait', label: t('Vertical') }, { value: 'landscape', label: t('Horizontal') }]} />
            <Segmented label={t('Márgenes')} value={settings.margins} onChange={(v) => set('margins', v)} options={[{ value: 'small', label: t('Chicos') }, { value: 'medium', label: t('Medianos') }, { value: 'large', label: t('Grandes') }, { value: 'custom', label: t('Otro') }]} />
            {settings.margins === 'custom' && <SliderInput label={t('Margen')} value={settings.customMargin} min={5} max={40} format={(v) => `${v} mm`} onChange={(v) => set('customMargin', v)} />}
          </Group>
          <Group title={t('Encabezado')}>
            <SelectInput label={t('Estilo')} value={settings.header.style} onChange={(style) => patch('header', { style })} options={[{ value: 'none', label: t('Sin encabezado') }, { value: 'line', label: t('Logo y línea') }, { value: 'title', label: t('Título centrado entre líneas') }, { value: 'band', label: t('Banda de color') }]} />
            {settings.header.style !== 'none' && (
              <>
                <SwitchRow label={t('Logo')} checked={settings.header.showLogo} onChange={(showLogo) => patch('header', { showLogo })} />
                <SwitchRow label={t('Nombre del negocio')} checked={settings.header.showName} onChange={(showName) => patch('header', { showName })} />
                {settings.header.style === 'line' && <Segmented label={t('Logo y nombre')} value={settings.header.align} onChange={(align) => patch('header', { align })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }, { value: 'right', label: t('Derecha') }]} />}
                <SwitchRow label={t('Número de página')} checked={settings.header.showPageNumber} onChange={(showPageNumber) => patch('header', { showPageNumber })} />
                <SwitchRow label={t('Título de la sección')} description={t('La categoría o el bloque que se está leyendo.')} checked={settings.header.showSectionTitle} onChange={(showSectionTitle) => patch('header', { showSectionTitle })} />
                <TextInput label={t('Texto')} value={settings.header.text} placeholder={t('Ej. Catálogo de servicios 2026')} onChange={(text) => patch('header', { text })} maxLength={80} />
                <ColorInput label="Color" value={settings.header.color || '#1A1A1A'} onChange={(color) => patch('header', { color })} />
                {settings.header.color && <Button size="small" color="inherit" onClick={() => patch('header', { color: '' })}>{t('Usar color del tema')}</Button>}
              </>
            )}
          </Group>
          <Group title={t('Pie de página')}>
            <SelectInput label={t('Estilo')} value={settings.footer.style} onChange={(style) => patch('footer', { style })} options={[{ value: 'none', label: t('Sin pie') }, { value: 'line', label: t('Línea fina') }, { value: 'band', label: t('Banda de color') }]} />
            {settings.footer.style !== 'none' && (
              <>
                <Segmented label={t('Numeración')} value={settings.footer.pageNumbers} onChange={(pageNumbers) => patch('footer', { pageNumbers })} options={[{ value: 'none', label: t('Sin') }, { value: 'simple', label: '3' }, { value: 'ofTotal', label: '3 / 12' }]} />
                {settings.footer.style === 'line' && <Segmented label={t('Alineación')} value={settings.footer.align} onChange={(align) => patch('footer', { align })} options={[{ value: 'spread', label: t('A los lados') }, { value: 'center', label: t('Centrado') }]} />}
                <SwitchRow label={t('Nombre del negocio')} checked={settings.footer.showBusinessName} onChange={(showBusinessName) => patch('footer', { showBusinessName })} />
                <SwitchRow label={t('Usuario de redes (@)')} checked={settings.footer.showSocial} onChange={(showSocial) => patch('footer', { showSocial })} />
                <SwitchRow label="WhatsApp" checked={settings.footer.showWhatsapp} onChange={(showWhatsapp) => patch('footer', { showWhatsapp })} />
                <SwitchRow label={t('Teléfono')} checked={settings.footer.showPhone} onChange={(showPhone) => patch('footer', { showPhone })} />
                <SwitchRow label="Email" checked={settings.footer.showEmail} onChange={(showEmail) => patch('footer', { showEmail })} />
                <SwitchRow label={t('Sitio web')} checked={settings.footer.showWebsite} onChange={(showWebsite) => patch('footer', { showWebsite })} />
                <TextInput label={t('Texto personalizado')} value={settings.footer.customText} placeholder={t('Ej. Precios válidos hasta agotar existencias')} onChange={(customText) => patch('footer', { customText })} maxLength={160} />
              </>
            )}
          </Group>
          <Group title={t('Decoración')} description={t('Formas genéricas en las esquinas, destellos y marco. Usan el color de acento.')}>
            <SelectInput label={t('Esquinas')} value={settings.decorations.corners} onChange={(corners) => patch('decorations', { corners })} options={DECORATIONS.map((d) => ({ value: d, label: t(DECORATION_LABELS[d]) }))} />
            <SwitchRow label={t('Destellos')} checked={settings.decorations.sparkles} onChange={(sparkles) => patch('decorations', { sparkles })} />
            <SwitchRow label={t('Marco de página')} checked={settings.decorations.frame} onChange={(frame) => patch('decorations', { frame })} />
            <ColorInput label="Color" value={settings.decorations.color || '#C8A96A'} onChange={(color) => patch('decorations', { color })} />
            {settings.decorations.color && <Button size="small" color="inherit" onClick={() => patch('decorations', { color: '' })}>{t('Usar color de acento')}</Button>}
          </Group>
          <Group title={t('Fondo de las páginas')} description={t('Heredado = el fondo global de tu sitio (color, imagen, patrón…).')}>
            <BackgroundEditor value={settings.background} onChange={(v) => set('background', v)} inheritLabel={t('Del sitio')} />
            <SwitchRow label={t('Ahorro de tinta')} description={t('Fondo blanco, sin decoración y colores legibles al imprimir.')} checked={settings.inkSaver} onChange={(v) => set('inkSaver', v)} />
          </Group>
        </>
      )}
    </Paper>
  );

  const pages = preview?.pages ?? 0;
  const previewPane = (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary">{t('Vista previa')}</Typography>
        {proposal && <Chip size="small" color="warning" label={t('Propuesta de Garfield')} />}
        {site.items.length > PREVIEW_MAX_ITEMS && <Chip size="small" label={t('Muestra los primeros {count} ítems', { count: PREVIEW_MAX_ITEMS })} />}
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" startIcon={loading ? <CircularProgress aria-label={t('Cargando')} size={14} /> : <RefreshCw size={14} />} onClick={() => void refresh()} disabled={loading || !enabled}>
          {t('Actualizar')}
        </Button>
      </Stack>
      <Box sx={{ flex: 1, minHeight: { xs: '75vh', lg: 0 } }}>
        {enabled ? (
          <PdfPreview
            blob={preview?.blob ?? null}
            page={page}
            onPage={setPage}
            busy={loading}
            pageLabel={(n) => {
              const block = blockAtPage(n);
              return block ? blockLabel(block) : '';
            }}
            onPageClick={(n) => {
              const block = blockAtPage(n);
              if (block && !proposal) {
                setSelected(block.id);
                setTab(block.type === 'cover' ? 'cover' : 'content');
              }
            }}
          />
        ) : (
          <Stack sx={(theme) => ({ height: '100%', alignItems: 'center', justifyContent: 'center', bgcolor: '#E9E9EE', ...theme.applyStyles('dark', { bgcolor: '#0A0B0E' }), borderRadius: 2 })}>
            <Typography variant="body2" color="text.secondary">{t('La exportación a PDF no está incluida en tu plan.')}</Typography>
          </Stack>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Stack>
  );

  return (
    <PdfGarfieldProvider settings={settings} onChange={setSettings} selectedBlockId={selected} onSelectBlock={(id) => { setSelected(id); setTab('content'); }} onPreview={setProposal} site={site}>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: { lg: 'calc(100vh - 56px - 32px)' } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h1">{t('Catálogo en PDF')}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {pages > 0
              ? t('{pages} páginas · Arma tu catálogo por bloques. Usa el diseño, los productos y las páginas de tu sitio.', { pages })
              : t('Arma tu catálogo por bloques. Usa el diseño, los productos y las páginas de tu sitio.')}
          </Typography>
        </Box>
        <Button color="inherit" onClick={() => run(() => savePdfSettings(settings), { onSuccess: () => setSaved(JSON.stringify(settings)) })} disabled={!dirty || pending}>
          {t('Guardar configuración')}
        </Button>
        <Button variant="contained" startIcon={downloading ? <CircularProgress aria-label={t('Cargando')} size={14} color="inherit" /> : <Download size={15} />} onClick={download} disabled={downloading || !enabled}>
          {t('Descargar PDF')}
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
    {canManage && enabled && (
      <>
        <GarfieldLauncher />
        <GarfieldPanel />
      </>
    )}
    </PdfGarfieldProvider>
  );
}

/* ------------------------------------------------------------ Estilo propio del PDF */

const fontList = FONT_IDS.map((id) => ({ value: id, label: FONTS[id].label }));

function PdfStyleEditor({ value, onChange }: { value: PdfSettings['style']; onChange: (style: PdfSettings['style']) => void }) {
  const t = useT();
  const fontOptions = [{ value: '', label: t('Como el sitio') }, ...fontList];
  const set = (patch: Partial<PdfSettings['style']>) => onChange({ ...value, ...patch });
  const color = (key: 'primary' | 'accent' | 'heading' | 'text', label: string, fallback: string) => (
    <Stack spacing={0.5}>
      <ColorInput label={label} value={value[key] || fallback} onChange={(c) => set({ [key]: c })} />
      {value[key] && <Button size="small" color="inherit" onClick={() => set({ [key]: '' })} sx={{ alignSelf: 'flex-start' }}>{t('Usar el del sitio')}</Button>}
    </Stack>
  );
  return (
    <>
      <Group title={t('Tipografía')} description={t('Por defecto el PDF usa la identidad de tu sitio. Cámbiala sólo para el PDF.')}>
        <SelectInput label={t('Títulos')} value={value.headingFont} onChange={(headingFont) => set({ headingFont })} options={fontOptions} />
        <SelectInput label={t('Textos')} value={value.bodyFont} onChange={(bodyFont) => set({ bodyFont })} options={fontOptions} />
        <SliderInput label={t('Tamaño del texto')} value={value.scale} min={0.8} max={1.3} step={0.02} format={(v) => `${Math.round(v * 100)}%`} onChange={(scale) => set({ scale })} />
        <Segmented label={t('Títulos en mayúsculas')} value={value.uppercaseHeadings} onChange={(uppercaseHeadings) => set({ uppercaseHeadings })} options={[{ value: 'inherit', label: t('Como el sitio') }, { value: 'yes', label: t('Sí') }, { value: 'no', label: t('No') }]} />
      </Group>
      <Group title={t('Espaciado')}>
        <Segmented label={t('Densidad')} value={value.density} onChange={(density) => set({ density })} options={PDF_DENSITIES.map((d) => ({ value: d, label: t(PDF_DENSITY_LABELS[d]) }))} />
      </Group>
      <Group title={t('Colores')} description={t('Vacío = los colores del sitio.')}>
        {color('primary', t('Color principal'), '#1A1A1A')}
        {color('accent', t('Acento y precios'), '#C8A96A')}
        {color('heading', t('Títulos'), '#1A1A1A')}
        {color('text', t('Texto'), '#333333')}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Portada */

function CoverEditor({ settings, patch }: { settings: PdfSettings; patch: (value: Partial<PdfSettings['cover']>) => void }) {
  const t = useT();
  const c = settings.cover;
  return (
    <>
      <Group title={t('Composición')} description={t('Actívala o desactívala en Contenido.')}>
        <SelectInput label={t('Diseño de portada')} value={c.layout} onChange={(layout) => patch({ layout })} options={COVER_LAYOUTS.map((l) => ({ value: l, label: t(COVER_LAYOUT_LABELS[l]) }))} />
        {c.layout !== 'split' && c.layout !== 'band' && c.layout !== 'framed' && c.layout !== 'centered' && <Segmented label={t('Alineación')} value={c.align} onChange={(align) => patch({ align })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />}
        <Segmented label={t('Tamaño del título')} value={c.titleSize} onChange={(titleSize) => patch({ titleSize })} options={[{ value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
        <Segmented label={t('Color del texto')} value={c.textColor} onChange={(textColor) => patch({ textColor })} options={[{ value: 'auto', label: 'Auto' }, { value: 'dark', label: t('Oscuro') }, { value: 'light', label: t('Claro') }]} />
      </Group>
      <Group title={t('Textos')}>
        <TextInput label={t('Antetítulo')} value={c.eyebrow} placeholder={t('Ej. CATÁLOGO')} onChange={(eyebrow) => patch({ eyebrow })} maxLength={80} />
        <TextInput label={t('Título')} value={c.title} placeholder={t('Vacío = nombre del negocio')} onChange={(title) => patch({ title })} maxLength={120} />
        <TextInput label={t('Subtítulo')} value={c.subtitle} placeholder={t('Vacío = slogan')} onChange={(subtitle) => patch({ subtitle })} maxLength={200} />
        <Stack direction="row" spacing={1}>
          <TextInput label={t('Fecha / temporada')} value={c.date} placeholder={t('Primavera 2026')} onChange={(date) => patch({ date })} maxLength={40} />
          <TextInput label={t('Versión')} value={c.version} placeholder={t('Edición 3')} onChange={(version) => patch({ version })} maxLength={40} />
        </Stack>
        <TextInput label={t('Texto adicional')} value={c.extraText} onChange={(extraText) => patch({ extraText })} multiline rows={2} maxLength={400} />
        <SwitchRow label={t('Logo')} checked={c.showLogo} onChange={(showLogo) => patch({ showLogo })} />
        <SwitchRow label={t('Descripción del negocio')} checked={c.showDescription} onChange={(showDescription) => patch({ showDescription })} />
        <SwitchRow label={t('Datos de contacto')} checked={c.showContact} onChange={(showContact) => patch({ showContact })} />
      </Group>
      <Group title={t('Imagen')}>
        <Segmented label={t('Imagen')} value={c.imageSource} onChange={(imageSource) => patch({ imageSource })} options={[{ value: 'cover', label: t('Del sitio') }, { value: 'custom', label: t('Otra') }, { value: 'none', label: t('Sin imagen') }]} />
        {c.imageSource === 'custom' && <MediaInput label={t('Imagen de portada')} value={c.imagePath} onChange={(imagePath) => patch({ imagePath })} />}
        {(c.layout === 'band' || c.layout === 'centered') && c.imageSource !== 'none' && (
          <Segmented label={t('Forma')} value={c.imageShape} onChange={(imageShape) => patch({ imageShape })} options={[{ value: 'rect', label: t('Recta') }, { value: 'rounded', label: t('Redond.') }, { value: 'circle', label: t('Círculo') }, { value: 'arch', label: t('Arco') }]} />
        )}
      </Group>
      <Group title={t('Decoración')}>
        <SelectInput label={t('Formas en las esquinas')} value={c.decoration} onChange={(decoration) => patch({ decoration })} options={DECORATIONS.map((d) => ({ value: d, label: t(DECORATION_LABELS[d]) }))} />
        <SwitchRow label={t('Destellos')} checked={c.sparkles} onChange={(sparkles) => patch({ sparkles })} />
      </Group>
      <Advanced title={t('Fondo y overlay de la portada')}>
        <BackgroundEditor value={c.background} onChange={(background) => patch({ background })} inheritLabel={t('Color del papel')} />
      </Advanced>
    </>
  );
}

/* ------------------------------------------------------------ Bloques */

function BlockEditor({ block, onChange, site, onCoverTab }: { block: PdfBlock; onChange: (block: PdfBlock) => void; site: SiteViewModel; onCoverTab: () => void }) {
  const t = useT();
  // Cada rama conoce el tipo exacto del bloque.
  const set = <T extends PdfBlockType>(b: PdfBlockOf<T>, value: Partial<PdfBlockOf<T>>) => onChange({ ...b, ...value } as PdfBlock);
  const newPage = block.type !== 'cover' && block.type !== 'pageBreak' && <SwitchRow label={t('Empieza en página nueva')} checked={block.newPage} onChange={(newPage) => onChange({ ...block, newPage })} />;
  const heading = (b: { title: string; subtitle: string }, update: (v: { title?: string; subtitle?: string }) => void) => (
    <>
      <TextInput label={t('Título')} value={b.title} onChange={(title) => update({ title })} maxLength={120} />
      <TextInput label={t('Subtítulo')} value={b.subtitle} onChange={(subtitle) => update({ subtitle })} multiline rows={2} maxLength={240} />
    </>
  );
  const perPage = (value: number, update: (n: number) => void) => (
    <SliderInput label={t('Ítems por página')} value={value} min={0} max={24} format={(v) => (v === 0 ? t('Automático') : String(v))} onChange={update} />
  );

  switch (block.type) {
    case 'cover':
      return (
        <Group description={t('La portada se diseña en su propia pestaña.')}>
          <Button onClick={onCoverTab} sx={{ alignSelf: 'flex-start' }}>{t('Editar portada')}</Button>
        </Group>
      );
    case 'pageBreak':
      return <Group description={t('Lo que sigue empieza en una página nueva.')}>{null}</Group>;
    case 'toc':
      return (
        <Group>
          <TextInput label={t('Título')} value={block.title} onChange={(title) => set(block, { title })} maxLength={80} />
          <SwitchRow label={t('Incluir categorías')} checked={block.showCategories} onChange={(showCategories) => set(block, { showCategories })} />
          {newPage}
        </Group>
      );
    case 'catalog':
      return (
        <>
          <Group>
            {heading(block, (v) => set(block, v))}
            <Segmented label={t('Incluir')} value={block.itemType} onChange={(itemType) => set(block, { itemType })} options={[{ value: 'any', label: t('Todo') }, { value: 'product', label: t('Productos') }, { value: 'service', label: t('Servicios') }]} />
            <Autocomplete
              multiple
              options={site.categories.map((c) => c.id)}
              value={block.categoryIds.filter((id) => site.categories.some((c) => c.id === id))}
              getOptionLabel={(id) => site.categories.find((c) => c.id === id)?.name ?? id}
              onChange={(_, categoryIds) => set(block, { categoryIds })}
              renderInput={(params) => <TextField {...params} label={t('Categorías (en este orden)')} placeholder={block.categoryIds.length ? '' : 'Todas'} />}
            />
            <SelectInput label={t('Orden de los ítems')} value={block.sort} onChange={(sort) => set(block, { sort })} options={SORT_OPTIONS.map((s) => ({ value: s, label: t(SORT_LABELS[s]) }))} />
          </Group>
          <Group title={t('Categorías')}>
            <SelectInput label={t('Presentación de cada categoría')} value={block.categoryStyle} onChange={(categoryStyle) => set(block, { categoryStyle })} options={CATEGORY_STYLES.map((s) => ({ value: s, label: t(CATEGORY_STYLE_LABELS[s]) }))} />
            {block.categoryStyle !== 'hero' && <SwitchRow label={t('Cada categoría en página nueva')} checked={block.categoryNewPage} onChange={(categoryNewPage) => set(block, { categoryNewPage })} />}
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
              renderInput={(params) => <TextField {...params} label={t('Atributos a comparar')} placeholder={block.attributeIds.length ? '' : 'Todos los visibles en PDF'} />}
            />
            <SwitchRow label={t('Imagen')} checked={block.showImage} onChange={(showImage) => set(block, { showImage })} />
            <SwitchRow label={t('Precio')} checked={block.showPrice} onChange={(showPrice) => set(block, { showPrice })} />
            <SwitchRow label={t('Código')} checked={block.showSku} onChange={(showSku) => set(block, { showSku })} />
            {newPage}
          </Group>
          <CollectionEditor value={block.collection} onChange={(collection) => set(block, { collection })} site={site} title={t('Qué comparar')} />
        </>
      );
    case 'text':
      return (
        <Group>
          {heading(block, (v) => set(block, v))}
          <RichTextInput label={t('Texto')} value={block.body} onChange={(body) => set(block, { body })} />
          <MediaInput label={t('Imagen (opcional)')} value={block.imagePath} onChange={(imagePath) => set(block, { imagePath })} />
          {block.imagePath && <Segmented label={t('Imagen')} value={block.imagePosition} onChange={(imagePosition) => set(block, { imagePosition })} options={[{ value: 'top', label: t('Arriba') }, { value: 'left', label: t('Izq.') }, { value: 'right', label: t('Der.') }, { value: 'bottom', label: t('Abajo') }]} />}
          {newPage}
        </Group>
      );
    case 'gallery':
      return (
        <>
          <Group>
            {heading(block, (v) => set(block, v))}
            <Segmented label={t('Fotos')} value={block.source} onChange={(source) => set(block, { source })} options={[{ value: 'items', label: t('De mis ítems') }, { value: 'custom', label: t('Propias') }]} />
            <Segmented label={t('Forma')} value={block.shape} onChange={(shape) => set(block, { shape })} options={[{ value: 'rect', label: t('Recta') }, { value: 'rounded', label: t('Redond.') }, { value: 'circle', label: t('Círculo') }, { value: 'hexagon', label: t('Hexágono') }]} />
            <SliderInput label={t('Columnas')} value={block.columns} min={2} max={5} onChange={(columns) => set(block, { columns })} />
            <SwitchRow label={t('Leyendas')} checked={block.captions} onChange={(captions) => set(block, { captions })} />
            {newPage}
          </Group>
          {block.source === 'items' ? (
            <CollectionEditor value={block.collection} onChange={(collection) => set(block, { collection })} site={site} />
          ) : (
            <Group title={t('Imágenes')}>
              <ListEditor
                items={block.images}
                onChange={(images) => set(block, { images })}
                create={() => ({ path: '', caption: '' })}
                addLabel={t('Agregar imagen')}
                max={40}
                itemTitle={(img, i) => img.caption || t('Imagen {n}', { n: i + 1 })}
                renderItem={(img, update) => (
                  <>
                    <MediaInput label={t('Imagen')} value={img.path || null} onChange={(path) => update({ ...img, path: path ?? '' })} width={96} />
                    <TextInput label={t('Leyenda')} value={img.caption} onChange={(caption) => update({ ...img, caption })} maxLength={120} />
                  </>
                )}
              />
            </Group>
          )}
        </>
      );
    case 'page':
      return (
        <Group description={t('Las secciones de la página (texto, galería, beneficios, testimonios…) se adaptan para impresión.')}>
          <SelectInput label={t('Página del sitio')} value={block.pageId} onChange={(pageId) => set(block, { pageId })} options={[{ value: '', label: t('Elige una página') }, ...site.pages.map((p) => ({ value: p.id, label: p.title }))]} />
          {newPage}
        </Group>
      );
    case 'image':
      return (
        <Group>
          <MediaInput label={t('Imagen')} value={block.imagePath} onChange={(imagePath) => set(block, { imagePath })} aspect="3 / 4" />
          <Segmented label={t('Tamaño')} value={block.size} onChange={(size) => set(block, { size })} options={[{ value: 'full', label: t('Página entera') }, { value: 'half', label: t('Media página') }, { value: 'third', label: t('Un tercio') }]} />
          <Segmented label={t('Encuadre')} value={block.fit} onChange={(fit) => set(block, { fit })} options={[{ value: 'cover', label: t('Llenar') }, { value: 'contain', label: t('Completa') }]} />
          {heading(block, (v) => set(block, v))}
          <Segmented label={t('Texto')} value={block.textPosition} onChange={(textPosition) => set(block, { textPosition })} options={[{ value: 'none', label: t('Sin') }, { value: 'top', label: t('Arriba') }, { value: 'center', label: t('Centro') }, { value: 'bottom', label: t('Abajo') }]} />
          {block.textPosition !== 'none' && <SliderInput label={t('Oscurecer la imagen')} value={block.overlay} min={0} max={90} format={(v) => `${v}%`} onChange={(overlay) => set(block, { overlay })} />}
          <TextInput label={t('Pie de foto')} value={block.caption} onChange={(caption) => set(block, { caption })} maxLength={200} />
          {block.size !== 'full' && newPage}
        </Group>
      );
    case 'promo':
      return (
        <>
          <Group>
            <TextInput label={t('Antetítulo')} value={block.eyebrow} placeholder={t('Ej. SÓLO ESTE MES')} onChange={(eyebrow) => set(block, { eyebrow })} maxLength={60} />
            {heading(block, (v) => set(block, v))}
            <TextInput label={t('Etiqueta destacada')} value={block.badge} placeholder={t('Ej. -30%')} onChange={(badge) => set(block, { badge })} maxLength={30} />
            <RichTextInput label={t('Texto')} value={block.body} onChange={(body) => set(block, { body })} />
            <TextInput label={t('Llamado a la acción')} value={block.cta} placeholder={t('Ej. Pide por WhatsApp')} onChange={(cta) => set(block, { cta })} maxLength={80} />
          </Group>
          <Group title={t('Diseño')}>
            <Segmented label={t('Composición')} value={block.layout} onChange={(layout) => set(block, { layout })} options={[{ value: 'split', label: t('Imagen al lado') }, { value: 'fullImage', label: t('Foto de fondo') }, { value: 'centered', label: t('Centrada') }]} />
            <MediaInput label={t('Imagen')} value={block.imagePath} onChange={(imagePath) => set(block, { imagePath })} />
            <BackgroundEditor value={block.background} onChange={(background) => set(block, { background })} inheritLabel={t('Suave')} />
          </Group>
          <CollectionEditor value={block.collection} onChange={(collection) => set(block, { collection })} site={site} title={t('Productos destacados debajo (cantidad 0 = ninguno)')} />
        </>
      );
    case 'backCover':
      return (
        <Group description={t('Siempre va al final, en una página propia.')}>
          <TextInput label={t('Título')} value={block.title} onChange={(title) => set(block, { title })} maxLength={120} />
          <TextInput label={t('Mensaje')} value={block.message} placeholder={t('Ej. Gracias por elegirnos. Escríbenos para hacer tu pedido.')} onChange={(message) => set(block, { message })} multiline rows={2} maxLength={400} />
          <SwitchRow label={t('Logo')} checked={block.showLogo} onChange={(showLogo) => set(block, { showLogo })} />
          <SwitchRow label={t('Datos de contacto')} checked={block.showContact} onChange={(showContact) => set(block, { showContact })} />
          <SwitchRow label={t('Redes sociales')} checked={block.showSocial} onChange={(showSocial) => set(block, { showSocial })} />
          <BackgroundEditor value={block.background} onChange={(background) => set(block, { background })} inheritLabel={t('Color principal')} />
        </Group>
      );
    case 'contact':
      return (
        <Group description={t('Los datos salen de Configuración › Información de contacto.')}>
          {heading(block, (v) => set(block, v))}
          <RichTextInput label={t('Notas (formas de pago, políticas, garantía…)')} value={block.notes} onChange={(notes) => set(block, { notes })} />
          <SwitchRow label={t('Redes sociales')} checked={block.showSocial} onChange={(showSocial) => set(block, { showSocial })} />
          {newPage}
        </Group>
      );
  }
}
