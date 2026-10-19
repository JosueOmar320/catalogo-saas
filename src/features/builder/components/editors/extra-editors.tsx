'use client';

import { Stack, TextField } from '@mui/material';
import type { ComponentType } from 'react';
import { buttonSchema } from '@/lib/site/section-schemas';
import { parseVideoUrl } from '@/lib/site/video';
import { ButtonEditor, ColumnsEditor, Group, IconPicker, LinkEditor, ListEditor, MediaInput, Segmented, SwitchRow, TextInput } from '../controls';
import { Heading, useContent, type EditorProps } from './content-editors';
import { useT } from '@/i18n/client';

const newId = () => crypto.randomUUID();

/* ------------------------------------------------------------ Imagen */

function ImageEditor(props: EditorProps<'image'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Imagen')}>
        <MediaInput label={t('Imagen')} value={c.image.path} onChange={(path) => set({ image: { path } })} aspect="16 / 9" width={160} />
        <TextInput label={t('Descripción (texto alternativo)')} value={c.alt} onChange={(alt) => set({ alt })} helper={t('Para lectores de pantalla y buscadores.')} maxLength={200} />
        <TextInput label={t('Leyenda (opcional)')} value={c.caption} onChange={(caption) => set({ caption })} maxLength={200} />
        <Segmented label={t('Proporción')} value={c.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: 'original', label: t('Original') }, { value: 'wide', label: '16:9' }, { value: 'landscape', label: '4:3' }, { value: 'square', label: '1:1' }, { value: 'portrait', label: '3:4' }]} />
        <SwitchRow label={t('Esquinas redondeadas')} checked={c.rounded} onChange={(rounded) => set({ rounded })} />
      </Group>
      <Group title={t('Al hacer clic')}>
        <LinkEditor value={c.link} onChange={(link) => set({ link })} pages={props.pages} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Video */

function VideoEditor(props: EditorProps<'video'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  const valid = !c.url || Boolean(parseVideoUrl(c.url));
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Video')}>
        <TextField
          label={t('Enlace del video')}
          value={c.url}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(e) => set({ url: e.target.value.trim() })}
          error={!valid}
          helperText={valid ? t('YouTube, Vimeo o un archivo .mp4 / .webm.') : t('No reconozco ese enlace. Usa YouTube, Vimeo, .mp4 o .webm (https).')}
        />
        <Segmented label={t('Proporción')} value={c.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: '16:9', label: '16:9' }, { value: '4:3', label: '4:3' }, { value: '1:1', label: '1:1' }, { value: '9:16', label: t('Vertical') }]} />
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'full', label: t('Solo video') }, { value: 'split', label: t('Con texto') }]} />
        {c.layout === 'split' && <TextInput label={t('Texto')} value={c.body} onChange={(body) => set({ body })} multiline rows={4} maxLength={2000} />}
        <SwitchRow label={t('Reproducir automáticamente (sin sonido)')} checked={c.autoplay} onChange={(autoplay) => set({ autoplay })} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Preguntas frecuentes */

function FaqEditor(props: EditorProps<'faq'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Preguntas')}>
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: newId(), question: 'Nueva pregunta', answer: '' })}
          addLabel={t('Agregar pregunta')}
          max={40}
          itemTitle={(item) => item.question || t('Pregunta')}
          renderItem={(item, update) => (
            <>
              <TextInput label={t('Pregunta')} value={item.question} onChange={(question) => update({ ...item, question })} maxLength={200} />
              <TextInput label={t('Respuesta')} value={item.answer} onChange={(answer) => update({ ...item, answer })} multiline rows={3} maxLength={2000} />
            </>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'accordion', label: t('Desplegable') }, { value: 'list', label: t('Lista') }, { value: 'twoColumns', label: t('2 columnas') }]} />
        {c.layout === 'accordion' && <SwitchRow label={t('Primera pregunta abierta')} checked={c.openFirst} onChange={(openFirst) => set({ openFirst })} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Precios */

function PricingEditor(props: EditorProps<'pricing'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Planes o paquetes')}>
        <ListEditor
          items={c.plans}
          onChange={(plans) => set({ plans })}
          create={() => ({ id: newId(), name: 'Plan', price: '$0', period: '/mes', description: '', features: [], highlighted: false, badge: '', button: buttonSchema.parse({ label: 'Elegir', link: { kind: 'whatsapp' } }) })}
          addLabel={t('Agregar plan')}
          max={6}
          itemTitle={(p) => p.name || t('Plan')}
          renderItem={(plan, update) => (
            <>
              <Stack direction="row" spacing={1}>
                <TextInput label={t('Nombre')} value={plan.name} onChange={(name) => update({ ...plan, name })} maxLength={60} />
                <TextInput label={t('Etiqueta')} value={plan.badge} placeholder={t('Más pedido')} onChange={(badge) => update({ ...plan, badge })} maxLength={30} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextInput label={t('Precio')} value={plan.price} placeholder="$499" onChange={(price) => update({ ...plan, price })} maxLength={40} />
                <TextInput label={t('Periodo')} value={plan.period} placeholder={t('/mes')} onChange={(period) => update({ ...plan, period })} maxLength={30} />
              </Stack>
              <TextInput label={t('Descripción')} value={plan.description} onChange={(description) => update({ ...plan, description })} maxLength={200} />
              <TextInput
                label={t('Incluye (una línea por beneficio)')}
                value={plan.features.join('\n')}
                onChange={(text) => update({ ...plan, features: text.split('\n').slice(0, 15).map((l) => l.slice(0, 120)) })}
                multiline
                rows={4}
              />
              <SwitchRow label={t('Destacar este plan')} checked={plan.highlighted} onChange={(highlighted) => update({ ...plan, highlighted })} />
              <ButtonEditor label={t('Botón')} value={plan.button} onChange={(button) => update({ ...plan, button })} pages={props.pages} />
            </>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={4} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Equipo */

function TeamEditor(props: EditorProps<'team'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Personas')}>
        <ListEditor
          items={c.members}
          onChange={(members) => set({ members })}
          create={() => ({ id: newId(), name: 'Nombre', role: '', bio: '', photo: null })}
          addLabel={t('Agregar persona')}
          itemTitle={(m) => m.name || t('Persona')}
          renderItem={(m, update) => (
            <>
              <MediaInput label={t('Foto')} value={m.photo} onChange={(photo) => update({ ...m, photo })} aspect="1 / 1" width={72} />
              <TextInput label={t('Nombre')} value={m.name} onChange={(name) => update({ ...m, name })} maxLength={80} />
              <TextInput label={t('Cargo')} value={m.role} onChange={(role) => update({ ...m, role })} maxLength={80} />
              <TextInput label={t('Descripción')} value={m.bio} onChange={(bio) => update({ ...m, bio })} multiline rows={2} maxLength={400} />
            </>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: t('Cuadrícula') }, { value: 'list', label: t('Lista') }]} />
        <Segmented label={t('Foto')} value={c.photoShape} onChange={(photoShape) => set({ photoShape })} options={[{ value: 'circle', label: t('Círculo') }, { value: 'rounded', label: t('Redondeada') }, { value: 'square', label: t('Cuadrada') }]} />
        {c.layout === 'grid' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={5} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Estadísticas */

function StatsEditor(props: EditorProps<'stats'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Cifras')}>
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: newId(), value: '+100', label: 'Clientes felices', icon: '' as const })}
          addLabel={t('Agregar cifra')}
          max={8}
          itemTitle={(i) => `${i.value} ${i.label}`.trim() || t('Cifra')}
          renderItem={(item, update) => (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <IconPicker value={item.icon || 'star'} onChange={(icon) => update({ ...item, icon })} />
                <TextInput label={t('Valor')} value={item.value} placeholder="+500" onChange={(value) => update({ ...item, value })} maxLength={24} />
              </Stack>
              <TextInput label={t('Descripción')} value={item.label} onChange={(label) => update({ ...item, label })} maxLength={80} />
            </>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Formato')} value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'inline', label: t('En línea') }, { value: 'cards', label: t('Tarjetas') }]} />
        <Segmented label={t('Alineación')} value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: t('Izquierda') }, { value: 'center', label: t('Centro') }]} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Logos */

function LogosEditor(props: EditorProps<'logos'>) {
  const t = useT();
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title={t('Logos')}>
        <ListEditor
          items={c.logos}
          onChange={(logos) => set({ logos })}
          create={() => ({ path: '', name: '', url: '' })}
          addLabel={t('Agregar logo')}
          max={30}
          itemTitle={(l, i) => l.name || t('Logo {n}', { n: i + 1 })}
          renderItem={(logo, update) => (
            <>
              <MediaInput label={t('Imagen')} value={logo.path || null} onChange={(path) => update({ ...logo, path: path ?? '' })} aspect="3 / 2" width={96} />
              <TextInput label={t('Nombre')} value={logo.name} onChange={(name) => update({ ...logo, name })} maxLength={80} />
              <TextInput label={t('Enlace (opcional)')} value={logo.url} placeholder="https://" onChange={(url) => update({ ...logo, url: url.trim() })} maxLength={500} />
            </>
          )}
        />
      </Group>
      <Group title={t('Presentación')}>
        <Segmented label={t('Tamaño')} value={c.size} onChange={(size) => set({ size })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
        <SwitchRow label={t('En escala de grises')} description={t('Se ven a color al pasar el mouse.')} checked={c.grayscale} onChange={(grayscale) => set({ grayscale })} />
        <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} />
      </Group>
    </>
  );
}

export const EXTRA_EDITORS: {
  image: ComponentType<EditorProps<'image'>>;
  video: ComponentType<EditorProps<'video'>>;
  faq: ComponentType<EditorProps<'faq'>>;
  pricing: ComponentType<EditorProps<'pricing'>>;
  team: ComponentType<EditorProps<'team'>>;
  stats: ComponentType<EditorProps<'stats'>>;
  logos: ComponentType<EditorProps<'logos'>>;
} = { image: ImageEditor, video: VideoEditor, faq: FaqEditor, pricing: PricingEditor, team: TeamEditor, stats: StatsEditor, logos: LogosEditor };
