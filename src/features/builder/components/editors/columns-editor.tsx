'use client';

import { Box, Button, ButtonBase, Chip, Collapse, IconButton, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowDown, ArrowUp, ChevronDown, Copy, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { COLUMN_PRESET_META, COLUMN_PRESETS, columnPreset } from '@/lib/site/column-presets';
import { buttonSchema, COLUMN_BLOCK_KINDS, COLUMN_LAYOUTS, columnCount, createColumnBlock, type ColumnBlock, type ColumnBlockKind, type ColumnLayout, type ColumnsContent } from '@/lib/site/section-schemas';
import { ButtonEditor, Group, IconPicker, ListEditor, MediaInput, RichTextInput, Segmented, SelectInput, SwitchRow, TextInput } from '../controls';
import { Heading, useContent, type EditorProps } from './content-editors';

/**
 * Editor de la sección Columnas: distribución (con miniaturas), cada columna
 * como un grupo con sus bloques (agregar, editar, mover, duplicar, quitar) y
 * composiciones listas para empezar.
 */

type Column = ColumnsContent['columns'][number];

const BLOCK_LABELS: Record<ColumnBlockKind, { label: string; hint: string }> = {
  heading: { label: 'Título', hint: 'Antetítulo y título.' },
  text: { label: 'Texto', hint: 'Párrafos con formato.' },
  image: { label: 'Imagen', hint: 'Foto con proporción y sombra.' },
  buttons: { label: 'Botones', hint: 'Hasta 4 botones.' },
  list: { label: 'Lista', hint: 'Con checks, íconos o números.' },
  card: { label: 'Tarjeta', hint: 'Ícono o imagen, título, texto y botón.' },
  icon: { label: 'Ícono', hint: 'Un ícono destacado.' },
  badge: { label: 'Etiqueta', hint: '"Nuevo", "Paso 1", "-20%".' },
  stat: { label: 'Cifra', hint: '+500 clientes.' },
  divider: { label: 'Línea', hint: 'Separador.' },
  spacer: { label: 'Espacio', hint: 'Aire vertical.' },
  video: { label: 'Video', hint: 'YouTube, Vimeo o .mp4.' },
};

function blockSummary(b: ColumnBlock): string {
  switch (b.kind) {
    case 'heading':
      return b.text || 'Título';
    case 'text':
      return b.body.replace(/[*_#>[\]()-]/g, '').slice(0, 40) || 'Texto';
    case 'buttons':
      return b.items.map((i) => i.label).filter(Boolean).join(' · ') || 'Botones';
    case 'list':
      return `${b.items.length} ítems`;
    case 'card':
      return b.title || 'Tarjeta';
    case 'badge':
      return b.text || 'Etiqueta';
    case 'stat':
      return `${b.value} ${b.label}`.trim() || 'Cifra';
    default:
      return BLOCK_LABELS[b.kind].label;
  }
}

/** Miniatura de la distribución: barras con el ancho de cada columna. */
function LayoutThumb({ layout }: { layout: ColumnLayout }) {
  const parts = layout.split('-').map(Number);
  const total = parts.reduce((a, b) => a + b, 0);
  return (
    <Stack direction="row" sx={{ width: 54, height: 22, gap: '3px' }} aria-hidden>
      {parts.map((p, i) => <Box key={i} sx={{ flex: p / total, borderRadius: 0.5, bgcolor: 'currentColor', opacity: 0.4 }} />)}
    </Stack>
  );
}

function BlockFields({ block, onChange, pages }: { block: ColumnBlock; onChange: (b: ColumnBlock) => void; pages: EditorProps<'columns'>['pages'] }) {
  const set = (patch: Partial<ColumnBlock>) => onChange({ ...block, ...patch } as ColumnBlock);
  switch (block.kind) {
    case 'heading':
      return (
        <>
          <TextInput label="Antetítulo (opcional)" value={block.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={80} />
          <TextInput label="Título" value={block.text} onChange={(text) => set({ text })} maxLength={200} />
          <Segmented label="Tamaño" value={block.level} onChange={(level) => set({ level })} options={[{ value: 'h2', label: 'Grande' }, { value: 'h3', label: 'Mediano' }, { value: 'h4', label: 'Chico' }]} />
        </>
      );
    case 'text':
      return (
        <>
          <RichTextInput label="Texto" value={block.body} onChange={(body) => set({ body })} />
          <Segmented label="Tamaño" value={block.size} onChange={(size) => set({ size })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
        </>
      );
    case 'image':
      return (
        <>
          <MediaInput label="Imagen" value={block.image.path} onChange={(path) => set({ image: { path } })} width={140} />
          <TextInput label="Descripción" value={block.alt} onChange={(alt) => set({ alt })} maxLength={200} />
          <Segmented label="Proporción" value={block.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: 'original', label: 'Original' }, { value: 'wide', label: '16:9' }, { value: 'landscape', label: '4:3' }, { value: 'square', label: '1:1' }, { value: 'portrait', label: '3:4' }]} />
          <SwitchRow label="Esquinas redondeadas" checked={block.rounded} onChange={(rounded) => set({ rounded })} />
          <SwitchRow label="Sombra" checked={block.shadow} onChange={(shadow) => set({ shadow })} />
        </>
      );
    case 'buttons':
      return (
        <ListEditor
          items={block.items}
          onChange={(items) => set({ items })}
          create={() => buttonSchema.parse({ label: 'Botón', link: { kind: 'whatsapp' }, variant: block.items.length ? 'secondary' : 'primary' })}
          addLabel="Agregar botón"
          max={4}
          itemTitle={(b, i) => b.label || `Botón ${i + 1}`}
          renderItem={(b, update) => <ButtonEditor label="Botón" value={b} onChange={update} pages={pages} />}
        />
      );
    case 'list':
      return (
        <>
          <Segmented label="Viñeta" value={block.marker} onChange={(marker) => set({ marker })} options={[{ value: 'check', label: '✓' }, { value: 'icon', label: 'Íconos' }, { value: 'number', label: '1·2·3' }, { value: 'bullet', label: '•' }]} />
          <ListEditor
            items={block.items}
            onChange={(items) => set({ items })}
            create={() => ({ id: crypto.randomUUID(), text: '', icon: '' as const })}
            addLabel="Agregar ítem"
            max={20}
            itemTitle={(item, i) => item.text || `Ítem ${i + 1}`}
            renderItem={(item, update) => (
              <>
                <TextInput label="Texto" value={item.text} onChange={(text) => update({ ...item, text })} maxLength={240} />
                {block.marker === 'icon' && <IconPicker value={item.icon || 'check'} onChange={(icon) => update({ ...item, icon })} />}
              </>
            )}
          />
        </>
      );
    case 'card':
      return (
        <>
          <IconPicker value={block.icon || 'sparkles'} onChange={(icon) => set({ icon })} />
          <MediaInput label="Imagen (en lugar del ícono)" value={block.image.path} onChange={(path) => set({ image: { path } })} width={120} />
          <TextInput label="Título" value={block.title} onChange={(title) => set({ title })} maxLength={120} />
          <TextInput label="Texto" value={block.text} onChange={(text) => set({ text })} multiline rows={3} maxLength={600} />
          <ButtonEditor label="Botón (opcional)" value={block.button} onChange={(button) => set({ button })} pages={pages} />
        </>
      );
    case 'icon':
      return (
        <>
          <IconPicker value={block.icon} onChange={(icon) => set({ icon })} />
          <Segmented label="Tamaño" value={block.size} onChange={(size) => set({ size })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />
          <Segmented label="Fondo" value={block.shape} onChange={(shape) => set({ shape })} options={[{ value: 'none', label: 'Sin' }, { value: 'circle', label: 'Círculo' }, { value: 'square', label: 'Cuadrado' }]} />
        </>
      );
    case 'badge':
      return (
        <>
          <TextInput label="Texto" value={block.text} onChange={(text) => set({ text })} maxLength={40} />
          <Segmented label="Color" value={block.tone} onChange={(tone) => set({ tone })} options={[{ value: 'accent', label: 'Acento' }, { value: 'primary', label: 'Principal' }, { value: 'neutral', label: 'Neutro' }]} />
        </>
      );
    case 'stat':
      return (
        <Stack direction="row" spacing={1}>
          <TextInput label="Cifra" value={block.value} placeholder="+500" onChange={(value) => set({ value })} maxLength={24} />
          <TextInput label="Etiqueta" value={block.label} placeholder="clientes" onChange={(label) => set({ label })} maxLength={80} />
        </Stack>
      );
    case 'spacer':
      return <Segmented label="Alto" value={block.size} onChange={(size) => set({ size })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} />;
    case 'video':
      return (
        <>
          <TextInput label="Enlace del video" value={block.url} placeholder="https://youtu.be/…" onChange={(url) => set({ url })} maxLength={500} />
          <Segmented label="Proporción" value={block.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: '16:9', label: '16:9' }, { value: '4:3', label: '4:3' }, { value: '1:1', label: '1:1' }]} />
        </>
      );
    case 'divider':
      return <Typography variant="caption" color="text.secondary">Una línea fina que separa bloques.</Typography>;
  }
}

function ColumnEditor({ column, index, onChange, pages }: { column: Column; index: number; onChange: (c: Column) => void; pages: EditorProps<'columns'>['pages'] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const setBlocks = (blocks: ColumnBlock[]) => onChange({ ...column, blocks });
  const move = (i: number, to: number) => {
    const blocks = [...column.blocks];
    const [b] = blocks.splice(i, 1);
    blocks.splice(to, 0, b);
    setBlocks(blocks);
  };
  return (
    <Group title={`Columna ${index + 1}`}>
      <Stack direction="row" spacing={1}>
        <Box sx={{ flex: 1 }}>
          <Segmented label="Alineación" value={column.align} onChange={(align) => onChange({ ...column, align })} options={[{ value: 'left', label: 'Izq.' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Der.' }]} />
        </Box>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Box sx={{ flex: 1 }}>
          <SelectInput label="Fondo de la columna" value={column.surface} onChange={(surface) => onChange({ ...column, surface })} options={[{ value: 'none', label: 'Sin fondo' }, { value: 'card', label: 'Tarjeta' }, { value: 'soft', label: 'Suave' }, { value: 'outline', label: 'Contorno' }]} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <SelectInput label="Relleno" value={column.padding} onChange={(padding) => onChange({ ...column, padding })} options={[{ value: 'none', label: 'Automático' }, { value: 'sm', label: 'Chico' }, { value: 'md', label: 'Medio' }, { value: 'lg', label: 'Grande' }]} />
        </Box>
      </Stack>

      <Stack spacing={0.75}>
        {column.blocks.length === 0 && <Typography variant="caption" color="text.secondary">Sin bloques. Agrega un título, un texto, una imagen…</Typography>}
        {column.blocks.map((block, i) => {
          const expanded = open === block.id;
          return (
            <Box key={block.id} sx={{ border: 1, borderColor: expanded ? 'primary.main' : 'divider', borderRadius: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: 'center', pl: 1, pr: 0.5 }}>
                <ButtonBase onClick={() => setOpen(expanded ? null : block.id)} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1, py: 0.9 }}>
                  <Chip size="small" label={BLOCK_LABELS[block.kind].label} sx={{ height: 20, fontSize: 11 }} />
                  <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{blockSummary(block)}</Typography>
                  <Box sx={{ ml: 'auto', display: 'flex', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><ChevronDown size={15} /></Box>
                </ButtonBase>
                <IconButton size="small" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Subir"><ArrowUp size={14} /></IconButton>
                <IconButton size="small" disabled={i === column.blocks.length - 1} onClick={() => move(i, i + 1)} aria-label="Bajar"><ArrowDown size={14} /></IconButton>
                <Tooltip title="Duplicar"><IconButton size="small" disabled={column.blocks.length >= 12} onClick={() => setBlocks([...column.blocks.slice(0, i + 1), { ...structuredClone(block), id: crypto.randomUUID() }, ...column.blocks.slice(i + 1)])} aria-label="Duplicar"><Copy size={14} /></IconButton></Tooltip>
                <IconButton size="small" onClick={() => setBlocks(column.blocks.filter((b) => b.id !== block.id))} aria-label="Quitar bloque"><Trash2 size={14} /></IconButton>
              </Stack>
              <Collapse in={expanded} unmountOnExit>
                <Stack spacing={1.5} sx={{ p: 1.25, pt: 0.5 }}>
                  <BlockFields block={block} onChange={(next) => setBlocks(column.blocks.map((b) => (b.id === block.id ? next : b)))} pages={pages} />
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
      <Button size="small" startIcon={<Plus size={15} />} onClick={(e) => setAnchor(e.currentTarget)} disabled={column.blocks.length >= 12} sx={{ alignSelf: 'flex-start' }}>Agregar bloque</Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {COLUMN_BLOCK_KINDS.map((kind) => (
          <MenuItem
            key={kind}
            onClick={() => {
              const block = createColumnBlock(kind, kind === 'heading' ? { text: 'Título' } : kind === 'text' ? { body: 'Escribe aquí.' } : kind === 'buttons' ? { items: [buttonSchema.parse({ label: 'Escríbenos', link: { kind: 'whatsapp' } })] } : {});
              setBlocks([...column.blocks, block]);
              setOpen(block.id);
              setAnchor(null);
            }}
          >
            <ListItemText primary={BLOCK_LABELS[kind].label} secondary={BLOCK_LABELS[kind].hint} />
          </MenuItem>
        ))}
      </Menu>
    </Group>
  );
}

export function ColumnsSectionEditor(props: EditorProps<'columns'>) {
  const set = useContent(props);
  const c = props.section.content;
  const count = columnCount(c.layout);
  const [presetAnchor, setPresetAnchor] = useState<HTMLElement | null>(null);
  // Al cambiar la distribución se agregan columnas vacías (las que sobran se conservan ocultas).
  const setLayout = (layout: ColumnLayout) => {
    const needed = columnCount(layout);
    const columns = [...c.columns];
    const taken = new Set(columns.map((x) => x.id));
    let n = columns.length + 1;
    while (columns.length < needed) {
      while (taken.has(`c${n}`)) n += 1;
      taken.add(`c${n}`);
      columns.push({ id: `c${n}`, blocks: [], align: 'left', surface: 'none', padding: 'none' });
    }
    set({ layout, columns });
  };
  return (
    <>
      <Group>
        <Heading {...props} titlePlaceholder="Opcional" />
      </Group>
      <Group title="Distribución" description="Cuántas columnas y qué ancho tiene cada una en escritorio.">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }} role="radiogroup" aria-label="Distribución">
          {COLUMN_LAYOUTS.map((layout) => {
            const selected = c.layout === layout;
            return (
              <ButtonBase
                key={layout}
                role="radio"
                aria-checked={selected}
                onClick={() => setLayout(layout)}
                sx={{ flexDirection: 'column', gap: 0.5, py: 1, borderRadius: 1.5, border: 1, borderColor: selected ? 'primary.main' : 'divider', color: selected ? 'primary.main' : 'text.secondary', boxShadow: selected ? (t) => `0 0 0 1px ${t.palette.primary.main}` : 'none' }}
              >
                <LayoutThumb layout={layout} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{layout.replace(/-/g, ' : ')}</Typography>
              </ButtonBase>
            );
          })}
        </Box>
        <Button size="small" color="inherit" startIcon={<LayoutTemplate size={15} />} onClick={(e) => setPresetAnchor(e.currentTarget)} sx={{ alignSelf: 'flex-start' }}>Empezar con una composición</Button>
        <Menu anchorEl={presetAnchor} open={Boolean(presetAnchor)} onClose={() => setPresetAnchor(null)}>
          {COLUMN_PRESETS.map((preset) => (
            <MenuItem
              key={preset}
              onClick={() => {
                set(columnPreset(preset));
                setPresetAnchor(null);
              }}
            >
              <ListItemText primary={COLUMN_PRESET_META[preset].label} secondary={COLUMN_PRESET_META[preset].description} />
            </MenuItem>
          ))}
        </Menu>
        <Segmented label="Separación" value={c.gap} onChange={(gap) => set({ gap })} options={[{ value: 'sm', label: 'Chica' }, { value: 'md', label: 'Normal' }, { value: 'lg', label: 'Amplia' }]} />
        <Segmented label="Alineación vertical" value={c.verticalAlign} onChange={(verticalAlign) => set({ verticalAlign })} options={[{ value: 'top', label: 'Arriba' }, { value: 'center', label: 'Centro' }, { value: 'bottom', label: 'Abajo' }, { value: 'stretch', label: 'Igual alto' }]} />
      </Group>
      <Group title="Tablet y celular">
        <Segmented label="En tablet" value={c.tablet} onChange={(tablet) => set({ tablet })} options={[{ value: 'same', label: 'Como escritorio' }, { value: '2', label: '2 columnas' }, { value: '1', label: 'Apiladas' }]} />
        <Segmented label="En celular" value={c.mobile} onChange={(mobile) => set({ mobile })} options={[{ value: '1', label: 'Apiladas' }, { value: '2', label: '2 columnas' }]} />
        {c.mobile === '1' && <SwitchRow label="Invertir el orden en celular" description="Útil para que la imagen quede debajo del texto." checked={c.reverseOnMobile} onChange={(reverseOnMobile) => set({ reverseOnMobile })} />}
      </Group>
      {c.columns.slice(0, count).map((column, i) => (
        <ColumnEditor key={column.id} column={column} index={i} pages={props.pages} onChange={(next) => set({ columns: c.columns.map((x) => (x.id === column.id ? next : x)) })} />
      ))}
    </>
  );
}
