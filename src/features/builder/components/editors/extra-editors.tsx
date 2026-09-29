'use client';

import { Stack, TextField } from '@mui/material';
import type { ComponentType } from 'react';
import { buttonSchema } from '@/lib/site/section-schemas';
import { parseVideoUrl } from '@/lib/site/video';
import { ButtonEditor, ColumnsEditor, Group, IconPicker, LinkEditor, ListEditor, MediaInput, Segmented, SwitchRow, TextInput } from '../controls';
import { Heading, useContent, type EditorProps } from './content-editors';

const newId = () => crypto.randomUUID();

/* ------------------------------------------------------------ Imagen */

function ImageEditor(props: EditorProps<'image'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Imagen">
        <MediaInput label="Imagen" value={c.image.path} onChange={(path) => set({ image: { path } })} aspect="16 / 9" width={160} />
        <TextInput label="Descripción (texto alternativo)" value={c.alt} onChange={(alt) => set({ alt })} helper="Para lectores de pantalla y buscadores." maxLength={200} />
        <TextInput label="Leyenda (opcional)" value={c.caption} onChange={(caption) => set({ caption })} maxLength={200} />
        <Segmented label="Proporción" value={c.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: 'original', label: 'Original' }, { value: 'wide', label: '16:9' }, { value: 'landscape', label: '4:3' }, { value: 'square', label: '1:1' }, { value: 'portrait', label: '3:4' }]} />
        <SwitchRow label="Esquinas redondeadas" checked={c.rounded} onChange={(rounded) => set({ rounded })} />
      </Group>
      <Group title="Al hacer clic">
        <LinkEditor value={c.link} onChange={(link) => set({ link })} pages={props.pages} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Video */

function VideoEditor(props: EditorProps<'video'>) {
  const set = useContent(props);
  const c = props.section.content;
  const valid = !c.url || Boolean(parseVideoUrl(c.url));
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Video">
        <TextField
          label="Enlace del video"
          value={c.url}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(e) => set({ url: e.target.value.trim() })}
          error={!valid}
          helperText={valid ? 'YouTube, Vimeo o un archivo .mp4 / .webm.' : 'No reconozco ese enlace. Usa YouTube, Vimeo, .mp4 o .webm (https).'}
        />
        <Segmented label="Proporción" value={c.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: '16:9', label: '16:9' }, { value: '4:3', label: '4:3' }, { value: '1:1', label: '1:1' }, { value: '9:16', label: 'Vertical' }]} />
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'full', label: 'Solo video' }, { value: 'split', label: 'Con texto' }]} />
        {c.layout === 'split' && <TextInput label="Texto" value={c.body} onChange={(body) => set({ body })} multiline rows={4} maxLength={2000} />}
        <SwitchRow label="Reproducir automáticamente (sin sonido)" checked={c.autoplay} onChange={(autoplay) => set({ autoplay })} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Preguntas frecuentes */

function FaqEditor(props: EditorProps<'faq'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Preguntas">
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: newId(), question: 'Nueva pregunta', answer: '' })}
          addLabel="Agregar pregunta"
          max={40}
          itemTitle={(item) => item.question || 'Pregunta'}
          renderItem={(item, update) => (
            <>
              <TextInput label="Pregunta" value={item.question} onChange={(question) => update({ ...item, question })} maxLength={200} />
              <TextInput label="Respuesta" value={item.answer} onChange={(answer) => update({ ...item, answer })} multiline rows={3} maxLength={2000} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'accordion', label: 'Desplegable' }, { value: 'list', label: 'Lista' }, { value: 'twoColumns', label: '2 columnas' }]} />
        {c.layout === 'accordion' && <SwitchRow label="Primera pregunta abierta" checked={c.openFirst} onChange={(openFirst) => set({ openFirst })} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Precios */

function PricingEditor(props: EditorProps<'pricing'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Planes o paquetes">
        <ListEditor
          items={c.plans}
          onChange={(plans) => set({ plans })}
          create={() => ({ id: newId(), name: 'Plan', price: '$0', period: '/mes', description: '', features: [], highlighted: false, badge: '', button: buttonSchema.parse({ label: 'Elegir', link: { kind: 'whatsapp' } }) })}
          addLabel="Agregar plan"
          max={6}
          itemTitle={(p) => p.name || 'Plan'}
          renderItem={(plan, update) => (
            <>
              <Stack direction="row" spacing={1}>
                <TextInput label="Nombre" value={plan.name} onChange={(name) => update({ ...plan, name })} maxLength={60} />
                <TextInput label="Etiqueta" value={plan.badge} placeholder="Más pedido" onChange={(badge) => update({ ...plan, badge })} maxLength={30} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextInput label="Precio" value={plan.price} placeholder="$499" onChange={(price) => update({ ...plan, price })} maxLength={40} />
                <TextInput label="Periodo" value={plan.period} placeholder="/mes" onChange={(period) => update({ ...plan, period })} maxLength={30} />
              </Stack>
              <TextInput label="Descripción" value={plan.description} onChange={(description) => update({ ...plan, description })} maxLength={200} />
              <TextInput
                label="Incluye (una línea por beneficio)"
                value={plan.features.join('\n')}
                onChange={(text) => update({ ...plan, features: text.split('\n').slice(0, 15).map((l) => l.slice(0, 120)) })}
                multiline
                rows={4}
              />
              <SwitchRow label="Destacar este plan" checked={plan.highlighted} onChange={(highlighted) => update({ ...plan, highlighted })} />
              <ButtonEditor label="Botón" value={plan.button} onChange={(button) => update({ ...plan, button })} pages={props.pages} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={4} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Equipo */

function TeamEditor(props: EditorProps<'team'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Personas">
        <ListEditor
          items={c.members}
          onChange={(members) => set({ members })}
          create={() => ({ id: newId(), name: 'Nombre', role: '', bio: '', photo: null })}
          addLabel="Agregar persona"
          itemTitle={(m) => m.name || 'Persona'}
          renderItem={(m, update) => (
            <>
              <MediaInput label="Foto" value={m.photo} onChange={(photo) => update({ ...m, photo })} aspect="1 / 1" width={72} />
              <TextInput label="Nombre" value={m.name} onChange={(name) => update({ ...m, name })} maxLength={80} />
              <TextInput label="Cargo" value={m.role} onChange={(role) => update({ ...m, role })} maxLength={80} />
              <TextInput label="Descripción" value={m.bio} onChange={(bio) => update({ ...m, bio })} multiline rows={2} maxLength={400} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'grid', label: 'Cuadrícula' }, { value: 'list', label: 'Lista' }]} />
        <Segmented label="Foto" value={c.photoShape} onChange={(photoShape) => set({ photoShape })} options={[{ value: 'circle', label: 'Círculo' }, { value: 'rounded', label: 'Redondeada' }, { value: 'square', label: 'Cuadrada' }]} />
        {c.layout === 'grid' && <ColumnsEditor value={c.columns} onChange={(columns) => set({ columns })} maxDesktop={5} />}
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Estadísticas */

function StatsEditor(props: EditorProps<'stats'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Cifras">
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          create={() => ({ id: newId(), value: '+100', label: 'Clientes felices', icon: '' as const })}
          addLabel="Agregar cifra"
          max={8}
          itemTitle={(i) => `${i.value} ${i.label}`.trim() || 'Cifra'}
          renderItem={(item, update) => (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <IconPicker value={item.icon || 'star'} onChange={(icon) => update({ ...item, icon })} />
                <TextInput label="Valor" value={item.value} placeholder="+500" onChange={(value) => update({ ...item, value })} maxLength={24} />
              </Stack>
              <TextInput label="Descripción" value={item.label} onChange={(label) => update({ ...item, label })} maxLength={80} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <Segmented label="Formato" value={c.layout} onChange={(layout) => set({ layout })} options={[{ value: 'inline', label: 'En línea' }, { value: 'cards', label: 'Tarjetas' }]} />
        <Segmented label="Alineación" value={c.alignment} onChange={(alignment) => set({ alignment })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }]} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------ Logos */

function LogosEditor(props: EditorProps<'logos'>) {
  const set = useContent(props);
  const c = props.section.content;
  return (
    <>
      <Group>
        <Heading {...props} />
      </Group>
      <Group title="Logos">
        <ListEditor
          items={c.logos}
          onChange={(logos) => set({ logos })}
          create={() => ({ path: '', name: '', url: '' })}
          addLabel="Agregar logo"
          max={30}
          itemTitle={(l, i) => l.name || `Logo ${i + 1}`}
          renderItem={(logo, update) => (
            <>
              <MediaInput label="Imagen" value={logo.path || null} onChange={(path) => update({ ...logo, path: path ?? '' })} aspect="3 / 2" width={96} />
              <TextInput label="Nombre" value={logo.name} onChange={(name) => update({ ...logo, name })} maxLength={80} />
              <TextInput label="Enlace (opcional)" value={logo.url} placeholder="https://" onChange={(url) => update({ ...logo, url: url.trim() })} maxLength={500} />
            </>
          )}
        />
      </Group>
      <Group title="Presentación">
        <Segmented label="Tamaño" value={c.size} onChange={(size) => set({ size })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
        <SwitchRow label="En escala de grises" description="Se ven a color al pasar el mouse." checked={c.grayscale} onChange={(grayscale) => set({ grayscale })} />
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
