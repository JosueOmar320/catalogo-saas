'use client';

import { Alert, Box, Button, Chip, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { msg } from '@/i18n/translate';
import { FX_CATALOG } from '@/lib/site/fx';
import { HTML_EXAMPLES } from './html-examples';
import { MAX_HTML_LENGTH } from '@/lib/site/custom-code-config';
import { Advanced, Group, SliderInput, TextInput } from '../controls';
import { CodeField, CustomCodeDisabled } from './code-field';
import { useContent, type EditorProps } from './content-editors';
import { useT } from '@/i18n/client';

/** Lo que la sección HTML quita al mostrarse (para avisar antes de publicar). */
const REMOVED_IN_HTML = /<\s*(script|iframe|form|input|object|embed)\b|\son[a-z]+\s*=|javascript:/i;

function HtmlEditor(props: EditorProps<'html'>) {
  const t = useT();
  const set = useContent(props);
  const { html } = props.section.content;
  const [examples, setExamples] = useState<HTMLElement | null>(null);
  const insert = (code: string) => set({ html: html.trim() ? `${html.trim()}\n\n${code}` : code });
  return (
    <Group description={t('Tu HTML con su propio <style> (sólo afecta a esta sección), variables CSS y los colores del sitio (var(--c-primary), var(--c-accent)…). Sin scripts: para animar usa los efectos de abajo.')}>
      {!props.site.customCode && <CustomCodeDisabled />}
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" startIcon={<Sparkles size={14} />} onClick={(e) => setExamples(e.currentTarget)} aria-haspopup="menu">{t('Insertar ejemplo')}</Button>
        <Menu anchorEl={examples} open={Boolean(examples)} onClose={() => setExamples(null)}>
          {HTML_EXAMPLES.map((example) => (
            <MenuItem key={example.id} onClick={() => { insert(example.html); setExamples(null); }}>{t(example.label)}</MenuItem>
          ))}
        </Menu>
      </Stack>
      <CodeField label="HTML" value={html} onChange={(value) => set({ html: value })} maxLength={MAX_HTML_LENGTH} placeholder={'<div class="promo fx-fade-up">\n  <h2>¡2×1 los martes!</h2>\n</div>\n<style>\n  .promo { padding: 24px; border-radius: 16px; background: var(--c-accent-soft); }\n</style>'} />
      {REMOVED_IN_HTML.test(html) && (
        <Alert severity="info">{t('Los scripts, iframes, formularios y eventos (onclick…) no se permiten aquí y se quitan al publicar. Para código de otro servicio usa la sección «Widget con código».')}</Alert>
      )}
      <FxHelp />
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
  const c = props.section.content;
  return (
    <Group description={t('Pega el código que te da el otro servicio (reservas, formularios, mapas, chats). Corre aislado: no puede leer tu sitio ni los datos de tus visitantes.')}>
      {!props.site.customCode && <CustomCodeDisabled />}
      <TextInput label={t('Nombre del widget')} value={c.title} placeholder={t('ej. Reservas')} helper={t('Lo anuncian los lectores de pantalla.')} onChange={(title) => set({ title })} maxLength={80} />
      <CodeField label={t('Código')} value={c.code} onChange={(code) => set({ code })} maxLength={MAX_HTML_LENGTH} placeholder={'<div id="widget"></div>\n<script src="https://…"></script>'} />
      <SliderInput label={t('Alto')} value={c.height} min={0} max={1200} step={20} format={(v) => (v === 0 ? t('Automático') : `${v}px`)} onChange={(height) => set({ height })} />
      <Typography variant="caption" color="text.secondary">{t('Automático: el widget avisa su alto. Si se corta, fija un alto.')}</Typography>
    </Group>
  );
}

export const CODE_EDITORS = { html: HtmlEditor, embed: EmbedEditor };
