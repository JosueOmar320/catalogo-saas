'use client';

import { Alert, Typography } from '@mui/material';
import { MAX_HTML_LENGTH } from '@/lib/site/custom-code-config';
import { Group, SliderInput, TextInput } from '../controls';
import { CodeField, CustomCodeDisabled } from './code-field';
import { useContent, type EditorProps } from './content-editors';
import { useT } from '@/i18n/client';

/** Lo que la sección HTML quita al mostrarse (para avisar antes de publicar). */
const REMOVED_IN_HTML = /<\s*(script|iframe|form|input|button|object|embed|style)\b|\son[a-z]+\s*=|javascript:/i;

function HtmlEditor(props: EditorProps<'html'>) {
  const t = useT();
  const set = useContent(props);
  const { html } = props.section.content;
  return (
    <Group description={t('Usa etiquetas comunes (títulos, párrafos, listas, tablas, imágenes, enlaces) y clases para tu CSS. Toma los colores y las fuentes del sitio.')}>
      {!props.site.customCode && <CustomCodeDisabled />}
      <CodeField label="HTML" value={html} onChange={(value) => set({ html: value })} maxLength={MAX_HTML_LENGTH} placeholder={'<div class="promo">\n  <h2>¡2×1 los martes!</h2>\n  <p>En todas las bebidas.</p>\n</div>'} />
      {REMOVED_IN_HTML.test(html) && (
        <Alert severity="info">{t('Los scripts, iframes, formularios, estilos <style> y eventos (onclick…) no se permiten aquí y se quitan al publicar. Para código de otro servicio usa la sección «Widget con código»; para estilos, Diseño › CSS propio.')}</Alert>
      )}
    </Group>
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
