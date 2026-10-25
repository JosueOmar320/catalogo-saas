'use client';

import { Alert, AppBar, Box, Button, Chip, Dialog, IconButton, Menu, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Toolbar, Typography } from '@mui/material';
import { Expand, ImagePlus, Monitor, Smartphone, Sparkles, Tablet, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { useOptionalGarfield } from '@/features/assistant/components/GarfieldProvider';
import { MediaLibraryDialog } from '@/features/media/components/MediaLibraryDialog';
import { msg } from '@/i18n/translate';
import { FX_CATALOG } from '@/lib/site/fx';
import { HTML_EXAMPLES } from './html-examples';
import { hasOwnChrome, isFullDocument, MAX_EMBED_LENGTH, MAX_HTML_LENGTH, needsFullPageWidget, removedByCleaning } from '@/lib/site/custom-code-config';
import { createSection } from '@/lib/site/section-schemas';
import { useBuilder, useSelectedPage } from '../../state';
import { PageView, SiteShell } from '@/site-renderer';
import { Advanced, Group, SliderInput, SwitchRow, TextInput } from '../controls';
import { CodeField, CustomCodeDisabled } from './code-field';
import { useContent, type EditorProps } from './content-editors';
import { useT } from '@/i18n/client';

const REMOVED_LABELS = {
  scripts: msg('scripts'),
  events: msg('eventos (onclick…)'),
  forms: msg('formularios y campos de texto'),
  iframes: msg('iframes de otros servicios'),
  javascript: msg('enlaces javascript:'),
  fixed: msg('position: fixed'),
  import: msg('@import'),
} as const;

type HtmlEditorProps = EditorProps<'html'>;

/** Insertar: ejemplos listos e imágenes de la biblioteca (por su ruta: al publicarse es su URL). */
function HtmlInsertButtons({ onInsert }: { onInsert: (code: string) => void }) {
  const t = useT();
  const [examples, setExamples] = useState<HTMLElement | null>(null);
  const [library, setLibrary] = useState(false);
  return (
    <>
      <Button size="small" variant="outlined" startIcon={<Sparkles size={14} />} onClick={(e) => setExamples(e.currentTarget)} aria-haspopup="menu">{t('Insertar ejemplo')}</Button>
      <Menu anchorEl={examples} open={Boolean(examples)} onClose={() => setExamples(null)}>
        {HTML_EXAMPLES.map((example) => (
          <MenuItem key={example.id} onClick={() => { onInsert(example.html); setExamples(null); }}>{t(example.label)}</MenuItem>
        ))}
      </Menu>
      <Button size="small" variant="outlined" startIcon={<ImagePlus size={14} />} onClick={() => setLibrary(true)}>{t('Insertar imagen')}</Button>
      <MediaLibraryDialog open={library} onClose={() => setLibrary(false)} onSelect={(image) => { onInsert(`<img src="${image.path}" alt="" />`); setLibrary(false); }} />
    </>
  );
}

/** Lo que se quitará al publicar, en concreto. */
function CleaningNotice({ html }: { html: string }) {
  const t = useT();
  const removed = removedByCleaning(html);
  if (!removed.length) return null;
  return (
    <Alert severity="info">
      {t('Al publicar se quita: {list}. Para código de otro servicio usa la sección «Widget con código».', { list: removed.map((key) => t(REMOVED_LABELS[key])).join(', ') })}
    </Alert>
  );
}

/** Pedirle a Garfield un cambio a ESTA sección (está seleccionada: Garfield la ve como "selected"). */
function AskGarfieldAboutHtml({ onAsked }: { onAsked?: () => void }) {
  const t = useT();
  const garfield = useOptionalGarfield();
  const [request, setRequest] = useState('');
  if (!garfield) return null;
  const send = () => {
    if (!request.trim()) return;
    garfield.ask(t('En la sección HTML seleccionada: {request}', { request: request.trim() }));
    setRequest('');
    // En el editor grande: se cierra para ver la respuesta de Garfield y la vista previa.
    onAsked?.();
  };
  return (
    <Stack direction="row" spacing={1} component="form" onSubmit={(event) => { event.preventDefault(); send(); }}>
      <TextField size="small" fullWidth label={t('Pídele a Garfield un cambio')} placeholder={t('ej. hazla de 3 columnas con íconos y una animación al aparecer')} value={request} onChange={(e) => setRequest(e.target.value.slice(0, 400))} />
      <Button type="submit" variant="outlined" startIcon={<Wand2 size={14} />} disabled={!request.trim() || garfield.pending} sx={{ flexShrink: 0 }}>{t('Pedir')}</Button>
    </Stack>
  );
}

/** Una página que es un widget a pantalla completa no muestra el menú ni el pie del sitio (la página trae los suyos). */
function useHideSiteChrome() {
  const { dispatch } = useBuilder();
  const page = useSelectedPage();
  return () => dispatch({ type: 'updatePage', pageId: page.id, patch: { style: { ...page.style, header: 'hidden', hideFooter: true } } });
}

/**
 * Página completa (scripts, Tailwind por CDN, <head>…) pegada en la sección
 * HTML: ahí se perdería. Con un clic se vuelve «Widget con código» en línea
 * (mismo lugar, mismo código): entre el menú y el pie del sitio.
 */
function FullPageNotice({ section }: { section: HtmlEditorProps['section'] }) {
  const t = useT();
  const { dispatch } = useBuilder();
  if (!needsFullPageWidget(section.content.html)) return null;
  const convert = () => {
    const widget = createSection('embed', { title: '', code: section.content.html, height: 0, fullScreen: false }, section.style as never);
    dispatch({ type: 'updateSection', section: { ...widget, id: section.id, name: section.name } });
  };
  return (
    <Alert severity="warning" action={<Button color="inherit" size="small" onClick={convert}>{t('Convertir')}</Button>}>
      {t('Esto es una página completa o lleva scripts (por ejemplo, Tailwind por CDN): en la sección HTML se pierden y se ve mal. Conviértela en «Widget con código»: funciona tal cual, aislada, entre el menú y el pie de tu sitio.')}
    </Alert>
  );
}

const DEVICE_WIDTH = { desktop: '100%', tablet: 820, mobile: 390 } as const;

/** Vista previa de sólo esta sección, con el tema del sitio. */
function SectionPreview({ site, section, device }: { site: HtmlEditorProps['site']; section: HtmlEditorProps['section']; device: keyof typeof DEVICE_WIDTH }) {
  const home = site.pages.find((p) => p.isHome) ?? site.pages[0];
  // Otro id: la vista previa del editor (detrás) muestra la misma sección; sus ids y radios no deben chocar.
  const page = { ...home, sections: [{ ...section, id: `${section.id}-studio` }] };
  return (
    <Box sx={{ height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', bgcolor: '#E9E9EE', p: device === 'desktop' ? 0 : 2, contain: 'paint' }}>
      <Box sx={{ width: DEVICE_WIDTH[device], maxWidth: '100%', bgcolor: 'background.paper', alignSelf: 'flex-start', contain: 'paint' }}>
        <SiteShell theme={site.theme} language={site.settings.language} order={null} showBranding={false}>
          <PageView page={page} site={site} env={{ mode: 'preview', basePath: '/preview', currentPageId: page.id }} />
        </SiteShell>
      </Box>
    </Box>
  );
}

/** Editor grande: código a la izquierda y la sección en vivo a la derecha. */
function HtmlStudio({ open, onClose, ...props }: HtmlEditorProps & { open: boolean; onClose: () => void }) {
  const t = useT();
  const set = useContent(props);
  const { html } = props.section.content;
  const [device, setDevice] = useState<keyof typeof DEVICE_WIDTH>('desktop');
  const insert = (code: string) => set({ html: html.trim() ? `${html.trim()}\n\n${code}` : code });
  return (
    <Dialog open={open} onClose={onClose} fullScreen aria-labelledby="html-studio-title">
      <AppBar position="relative" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Typography id="html-studio-title" variant="subtitle1" sx={{ fontWeight: 700, mr: 1 }}>{t('Editor de HTML')}</Typography>
          <HtmlInsertButtons onInsert={insert} />
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup size="small" exclusive value={device} onChange={(_, v) => v && setDevice(v)} aria-label={t('Dispositivo')}>
            <ToggleButton value="desktop" aria-label={t('Escritorio')} sx={{ px: 1 }}><Monitor size={15} /></ToggleButton>
            <ToggleButton value="tablet" aria-label={t('Tablet')} sx={{ px: 1 }}><Tablet size={15} /></ToggleButton>
            <ToggleButton value="mobile" aria-label={t('Móvil')} sx={{ px: 1 }}><Smartphone size={15} /></ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={onClose} aria-label={t('Cerrar')}><X size={18} /></IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(360px, 1fr) minmax(0, 1.2fr)' }, gridTemplateRows: { xs: 'auto minmax(360px, 1fr)', md: '1fr' } }}>
        <Stack spacing={1.5} sx={{ p: 2, overflow: 'auto', borderRight: { md: 1 }, borderColor: 'divider' }}>
          {!props.site.customCode && <CustomCodeDisabled />}
          <CodeField label="HTML" value={html} onChange={(value) => set({ html: value })} maxLength={MAX_HTML_LENGTH} rows={24} maxRows={60} />
          <CleaningNotice html={html} />
          <AskGarfieldAboutHtml onAsked={onClose} />
        </Stack>
        <SectionPreview site={props.site} section={props.section} device={device} />
      </Box>
    </Dialog>
  );
}

function HtmlEditor(props: HtmlEditorProps) {
  const t = useT();
  const set = useContent(props);
  const { html } = props.section.content;
  const [studio, setStudio] = useState(false);
  const insert = (code: string) => set({ html: html.trim() ? `${html.trim()}\n\n${code}` : code });
  return (
    <Group description={t('Tu HTML con su propio <style> (sólo afecta a esta sección), variables CSS y los colores del sitio (var(--c-primary), var(--c-accent)…). Admite SVG, pestañas y acordeones sólo con CSS, videos de YouTube o Vimeo, mapas e imágenes de tu biblioteca. Sin scripts: para animar usa los efectos de abajo.')}>
      {!props.site.customCode && <CustomCodeDisabled />}
      <FullPageNotice section={props.section} />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <HtmlInsertButtons onInsert={insert} />
        <Button size="small" variant="contained" startIcon={<Expand size={14} />} onClick={() => setStudio(true)}>{t('Editor grande')}</Button>
      </Stack>
      <CodeField label="HTML" value={html} onChange={(value) => set({ html: value })} maxLength={MAX_HTML_LENGTH} placeholder={'<div class="promo fx-fade-up">\n  <h2>¡2×1 los martes!</h2>\n</div>\n<style>\n  .promo { padding: 24px; border-radius: 16px; background: var(--c-accent-soft); }\n</style>'} />
      <CleaningNotice html={html} />
      <AskGarfieldAboutHtml />
      <FxHelp />
      <HtmlStudio open={studio} onClose={() => setStudio(false)} {...props} />
    </Group>
  );
}

const FX_KINDS = [
  { kind: 'entrance', label: msg('Al aparecer') },
  { kind: 'loop', label: msg('En movimiento') },
  { kind: 'hover', label: msg('Al pasar el mouse') },
  { kind: 'interaction', label: msg('Interacciones') },
] as const;

/** Efectos disponibles: clic para copiar la clase o el atributo. */
function FxHelp() {
  const t = useT();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (name: string) => {
    const value = name.startsWith('data-fx') ? name : name.split(' ')[0];
    try {
      await navigator.clipboard.writeText(value);
      setCopied(name);
    } catch {}
  };
  return (
    <Advanced title={t('Efectos y animaciones')}>
      <Typography variant="caption" color="text.secondary">{t('Agrega la clase (class="fx-fade-up") o el atributo (data-fx="tilt") a cualquier elemento. No se animan si el visitante pidió reducir el movimiento.')}</Typography>
      {FX_KINDS.map(({ kind, label }) => (
        <Box key={kind}>
          <Typography variant="overline" color="text.secondary">{t(label)}</Typography>
          <Stack spacing={0.5}>
            {FX_CATALOG.filter((fx) => fx.kind === kind).map((fx) => (
              <Stack key={fx.name} direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                <Chip size="small" label={copied === fx.name ? t('Copiado') : fx.name} onClick={() => void copy(fx.name)} sx={{ fontFamily: 'ui-monospace, monospace', flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary">{t(fx.description)}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      ))}
    </Advanced>
  );
}

function EmbedEditor(props: EditorProps<'embed'>) {
  const t = useT();
  const set = useContent(props);
  const hideChrome = useHideSiteChrome();
  const page = useSelectedPage();
  const c = props.section.content;
  const fullDocument = isFullDocument(c.code);
  const chromeShown = page.style.header !== 'hidden' || !page.style.hideFooter;
  return (
    <Group description={t('Pega el código que te da el otro servicio (reservas, formularios, mapas, chats) o una página completa con sus scripts. Corre aislado: no puede leer tu sitio ni los datos de tus visitantes.')}>
      {!props.site.customCode && <CustomCodeDisabled />}
      <TextInput label={t('Nombre del widget')} value={c.title} placeholder={t('ej. Reservas')} helper={t('Lo anuncian los lectores de pantalla.')} onChange={(title) => set({ title })} maxLength={80} />
      <CodeField label={t('Código')} value={c.code} onChange={(code) => set({ code })} maxLength={MAX_EMBED_LENGTH} placeholder={'<div id="widget"></div>\n<script src="https://…"></script>'} />
      {fullDocument && !c.fullScreen && <Alert severity="info">{t('Página completa en línea: se ve entre el menú y el pie de tu sitio, de borde a borde. Su alto de pantalla (100vh), sus ventanas y botones fijos y sus animaciones al desplazarse se ajustan a la parte visible.')}</Alert>}
      {hasOwnChrome(c.code) && !c.fullScreen && <Typography variant="caption" color="text.secondary">{t('Trae su propio menú o pie: si deben reemplazar a los de tu sitio, usa «Pantalla completa» y ocúltalos en esta página.')}</Typography>}
      <SwitchRow label={t('Pantalla completa')} description={t('Ocupa toda la ventana con su propio scroll. Para páginas que traen su propio menú y pie.')} checked={c.fullScreen} onChange={(fullScreen) => set({ fullScreen })} />
      {c.fullScreen && chromeShown && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{t('Esta página todavía muestra el menú o el pie de tu sitio.')}</Typography>
          <Button size="small" onClick={hideChrome}>{t('Ocultarlos')}</Button>
        </Stack>
      )}
      {!c.fullScreen && (
        <>
          <SliderInput label={t('Alto')} value={c.height} min={0} max={1200} step={20} format={(v) => (v === 0 ? t('Automático') : `${v}px`)} onChange={(height) => set({ height })} />
          <Typography variant="caption" color="text.secondary">{t('Automático: crece con su contenido y se desplaza con la página. Con un alto fijo tiene su propio scroll.')}</Typography>
        </>
      )}
    </Group>
  );
}

export const CODE_EDITORS = { html: HtmlEditor, embed: EmbedEditor };
