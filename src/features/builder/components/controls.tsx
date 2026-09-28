'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  ButtonBase,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Bold, ChevronDown, ChevronUp, Italic, Link2, List, ListOrdered, Monitor, Plus, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { ColorField } from '@/components/form/ColorField';
import { ImageField } from '@/components/form/ImageField';
import { moveItem } from '@/components/ui/SortableList';
import { BACKGROUND_TYPES, type Background } from '@/lib/design/background';
import { ICON_IDS, ICONS } from '@/lib/design/icons';
import { PATTERN_IDS, PATTERNS, patternSvg } from '@/lib/design/patterns';
import type { SitePage } from '@/lib/site/pages';
import type { ButtonConfig, Columns, LinkTarget } from '@/lib/site/section-schemas';
import { mediaUrl } from '@/lib/utils/storage';
import { Icon } from '@/site-renderer/Icon';

/* ------------------------------------------------------------ Agrupadores */

export function Group({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <Box sx={{ py: 2, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      {title && <Typography variant="h4">{title}</Typography>}
      {description && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
          {description}
        </Typography>
      )}
      <Stack spacing={1.5} sx={{ mt: title ? 1.5 : 0 }}>{children}</Stack>
    </Box>
  );
}

/** Opciones avanzadas plegadas: la interfaz muestra primero lo esencial. */
export function Advanced({ title = 'Opciones avanzadas', children, defaultOpen = false }: { title?: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <Accordion disableGutters elevation={0} defaultExpanded={defaultOpen} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' }, borderBottom: 1, borderColor: 'divider' }}>
      <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ px: 0, minHeight: 44 }}>
        <Typography variant="h4">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0, pb: 2 }}>
        <Stack spacing={1.5}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  );
}

/* ------------------------------------------------------------ Campos básicos */

type TextProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
};

export function TextInput({ label, value, onChange, placeholder, helper, multiline, rows = 3, maxLength }: TextProps) {
  return (
    <TextField
      label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      multiline={multiline}
      minRows={multiline ? rows : undefined}
      helperText={helper}
      slotProps={{ htmlInput: { maxLength }, inputLabel: { shrink: true } }}
    />
  );
}

export function SelectInput<T extends string>({ label, value, options, onChange, helper }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; helper?: string }) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value as T)} helperText={helper} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
      ))}
    </TextField>
  );
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (value: T) => void }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="body2" sx={{ fontWeight: 500, flexShrink: 0 }}>{label}</Typography>
      <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, v) => v !== null && onChange(v)} aria-label={label} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {options.map((o) => (
          <ToggleButton key={String(o.value)} value={o.value} title={o.title} sx={{ px: 1.1, py: 0.35, textTransform: 'none', fontSize: 12.5 }}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}

export function SwitchRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        {description && <Typography variant="caption" color="text.secondary">{description}</Typography>}
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} slotProps={{ input: { 'aria-label': label } }} />
    </Stack>
  );
}

export function SliderInput({ label, value, min, max, step = 1, onChange, format = (v) => String(v) }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; format?: (value: number) => string }) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{format(value)}</Typography>
      </Stack>
      <Slider size="small" value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(v as number)} aria-label={label} />
    </Box>
  );
}

export function ColorInput({ label, value, onChange, description }: { label: string; value: string; onChange: (value: string) => void; description?: string }) {
  return <ColorField label={label} description={description} value={value} onChange={onChange} />;
}

export function MediaInput({ label, value, onChange, description, aspect = '4 / 3', width = 120 }: { label: string; value: string | null; onChange: (path: string | null) => void; description?: string; aspect?: string; width?: number }) {
  return <ImageField label={label} description={description} kind="site" value={mediaUrl(value)} onChange={(path) => onChange(path)} aspectRatio={aspect} width={width} />;
}

/* ------------------------------------------------------------ Texto enriquecido */

const RICH_TOOLS = [
  { title: 'Negrita', action: 'bold', icon: <Bold size={14} /> },
  { title: 'Cursiva', action: 'italic', icon: <Italic size={14} /> },
  { title: 'Lista', action: 'list', icon: <List size={14} /> },
  { title: 'Lista numerada', action: 'ordered', icon: <ListOrdered size={14} /> },
  { title: 'Enlace', action: 'link', icon: <Link2 size={14} /> },
  { title: 'Subtítulo', action: 'heading', icon: <Typography sx={{ fontSize: 12, fontWeight: 700 }}>H</Typography> },
] as const;

/** Textarea con barra mínima: **negrita**, *cursiva*, listas y enlaces. */
export function RichTextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = (before: string, after = before, placeholder = 'texto') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const lineStart = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    requestAnimationFrame(() => el.focus());
  };
  const apply = (action: (typeof RICH_TOOLS)[number]['action']) => {
    if (action === 'bold') wrap('**');
    else if (action === 'italic') wrap('*');
    else if (action === 'list') linePrefix('- ');
    else if (action === 'ordered') linePrefix('1. ');
    else if (action === 'link') wrap('[', '](https://)', 'texto del enlace');
    else linePrefix('### ');
  };
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        <Stack direction="row">
          {RICH_TOOLS.map((tool) => (
            <Tooltip key={tool.title} title={tool.title}>
              <IconButton size="small" onClick={() => apply(tool.action)} aria-label={tool.title}>{tool.icon}</IconButton>
            </Tooltip>
          ))}
        </Stack>
      </Stack>
      <TextField inputRef={ref} value={value} onChange={(e) => onChange(e.target.value)} multiline minRows={5} maxRows={16} slotProps={{ htmlInput: { maxLength: 8000, style: { fontSize: 13.5, lineHeight: 1.5 } } }} />
    </Box>
  );
}

/* ------------------------------------------------------------ Íconos */

export function IconPicker({ value, onChange }: { value: string; onChange: (value: (typeof ICON_IDS)[number]) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const list = ICON_IDS.filter((id) => !query || ICONS[id].label.toLowerCase().includes(query.toLowerCase()) || id.includes(query.toLowerCase()));
  return (
    <>
      <Tooltip title="Cambiar ícono">
        <ButtonBase onClick={(e) => setAnchor(e.currentTarget)} sx={{ width: 40, height: 40, borderRadius: 1, border: 1, borderColor: 'divider', flexShrink: 0 }} aria-label="Elegir ícono">
          <Icon id={value} size={20} />
        </ButtonBase>
      </Tooltip>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ p: 1.5, width: 300 }}>
          <TextField placeholder="Buscar ícono" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mt: 1, maxHeight: 240, overflowY: 'auto' }}>
            {list.map((id) => (
              <Tooltip key={id} title={ICONS[id].label}>
                <ButtonBase
                  onClick={() => {
                    onChange(id);
                    setAnchor(null);
                  }}
                  sx={{ height: 36, borderRadius: 1, bgcolor: id === value ? 'primary.light' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}
                  aria-label={ICONS[id].label}
                >
                  <Icon id={id} size={18} />
                </ButtonBase>
              </Tooltip>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  );
}

/* ------------------------------------------------------------ Enlaces y botones */

const LINK_KINDS: { value: LinkTarget['kind']; label: string }[] = [
  { value: 'none', label: 'Sin enlace' },
  { value: 'page', label: 'Página del sitio' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Llamada' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'Enlace externo' },
];

export function LinkEditor({ value, onChange, pages }: { value: LinkTarget; onChange: (value: LinkTarget) => void; pages: SitePage[] }) {
  return (
    <Stack spacing={1.25}>
      <SelectInput label="Al hacer clic" value={value.kind} options={LINK_KINDS} onChange={(kind) => onChange({ ...value, kind })} />
      {value.kind === 'page' && (
        <SelectInput label="Página" value={value.pageId} options={[{ value: '', label: 'Elige una página' }, ...pages.map((p) => ({ value: p.id, label: p.title }))]} onChange={(pageId) => onChange({ ...value, pageId })} />
      )}
      {value.kind === 'url' && <TextInput label="URL" value={value.url} placeholder="https://" onChange={(url) => onChange({ ...value, url })} />}
      {value.kind === 'whatsapp' && <TextInput label="Mensaje inicial (opcional)" value={value.message} onChange={(message) => onChange({ ...value, message })} maxLength={300} />}
    </Stack>
  );
}

export function ButtonEditor({ label, value, onChange, pages }: { label: string; value: ButtonConfig; onChange: (value: ButtonConfig) => void; pages: SitePage[] }) {
  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</Typography>
      <Stack spacing={1.25} sx={{ mt: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <IconPicker value={value.icon || 'arrow-right'} onChange={(icon) => onChange({ ...value, icon })} />
          <TextInput label="Texto del botón" value={value.label} placeholder="Vacío = sin botón" onChange={(text) => onChange({ ...value, label: text })} maxLength={40} />
        </Stack>
        {value.icon && (
          <Button size="small" color="inherit" sx={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...value, icon: '' })}>Quitar ícono</Button>
        )}
        {value.label && (
          <>
            <LinkEditor value={value.link} onChange={(link) => onChange({ ...value, link })} pages={pages} />
            <Segmented label="Estilo" value={value.variant} onChange={(variant) => onChange({ ...value, variant })} options={[{ value: 'primary', label: 'Principal' }, { value: 'secondary', label: 'Secundario' }]} />
          </>
        )}
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------ Columnas responsive */

export function ColumnsEditor({ value, onChange, maxDesktop = 6 }: { value: Columns; onChange: (value: Columns) => void; maxDesktop?: number }) {
  const row = (icon: ReactNode, key: keyof Columns, max: number) => (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Box sx={{ color: 'text.secondary', display: 'flex', width: 20 }}>{icon}</Box>
      <ToggleButtonGroup size="small" exclusive value={value[key]} onChange={(_, v) => v && onChange({ ...value, [key]: v })}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <ToggleButton key={n} value={n} sx={{ px: 1.2, py: 0.3 }}>{n}</ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Columnas por dispositivo</Typography>
      <Stack spacing={0.75}>
        {row(<Monitor size={16} />, 'desktop', maxDesktop)}
        {row(<Tablet size={16} />, 'tablet', 4)}
        {row(<Smartphone size={16} />, 'mobile', 2)}
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------ Listas editables */

export function ListEditor<T extends object>({
  items,
  onChange,
  create,
  renderItem,
  addLabel,
  max = 24,
  itemTitle,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  renderItem: (item: T, update: (item: T) => void) => ReactNode;
  addLabel: string;
  max?: number;
  itemTitle: (item: T, index: number) => string;
}) {
  return (
    <Stack spacing={1}>
      {items.map((item, index) => (
        <Box key={(item as { id?: string }).id ?? index} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
          <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }} noWrap>{itemTitle(item, index)}</Typography>
            <IconButton size="small" disabled={index === 0} onClick={() => onChange(moveItem(items, index, index - 1))} aria-label="Subir"><ChevronUp size={14} /></IconButton>
            <IconButton size="small" disabled={index === items.length - 1} onClick={() => onChange(moveItem(items, index, index + 1))} aria-label="Bajar"><ChevronDown size={14} /></IconButton>
            <IconButton size="small" onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label="Quitar"><Trash2 size={14} /></IconButton>
          </Stack>
          <Stack spacing={1.25}>{renderItem(item, (next) => onChange(items.map((it, i) => (i === index ? next : it))))}</Stack>
        </Box>
      ))}
      {items.length < max && (
        <Button variant="outlined" color="inherit" startIcon={<Plus size={14} />} onClick={() => onChange([...items, create()])}>
          {addLabel}
        </Button>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------ Fondos */

const BG_LABELS: Record<(typeof BACKGROUND_TYPES)[number], string> = {
  inherit: 'Heredado',
  color: 'Color',
  gradient: 'Degradado',
  image: 'Imagen',
  pattern: 'Patrón',
};

/**
 * Editor de fondo reutilizable (global, página, sección, header, footer, PDF).
 * `allowInherit` muestra la opción "Heredado" (usa el fondo del nivel superior).
 */
export function BackgroundEditor({ value, onChange, allowInherit = true, inheritLabel = 'Heredado' }: { value: Background; onChange: (value: Background) => void; allowInherit?: boolean; inheritLabel?: string }) {
  const types = BACKGROUND_TYPES.filter((t) => allowInherit || t !== 'inherit');
  const set = (patch: Partial<Background>) => onChange({ ...value, ...patch });
  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup size="small" exclusive value={value.type} onChange={(_, type) => type && set({ type })} sx={{ flexWrap: 'wrap' }}>
        {types.map((t) => (
          <ToggleButton key={t} value={t} sx={{ textTransform: 'none', px: 1.1, py: 0.35, fontSize: 12.5 }}>
            {t === 'inherit' ? inheritLabel : BG_LABELS[t]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {(value.type === 'color' || value.type === 'pattern' || value.type === 'image') && (
        <ColorInput label={value.type === 'color' ? 'Color' : 'Color base'} value={value.color} onChange={(color) => set({ color })} />
      )}

      {value.type === 'gradient' && (
        <>
          <Segmented label="Tipo" value={value.gradient.kind} onChange={(kind) => set({ gradient: { ...value.gradient, kind } })} options={[{ value: 'linear', label: 'Lineal' }, { value: 'radial', label: 'Radial' }]} />
          <ColorInput label="Desde" value={value.gradient.from} onChange={(from) => set({ gradient: { ...value.gradient, from } })} />
          <ColorInput label="Hasta" value={value.gradient.to} onChange={(to) => set({ gradient: { ...value.gradient, to } })} />
          {value.gradient.kind === 'linear' && (
            <SliderInput label="Dirección" value={value.gradient.angle} min={0} max={360} step={15} format={(v) => `${v}°`} onChange={(angle) => set({ gradient: { ...value.gradient, angle } })} />
          )}
        </>
      )}

      {value.type === 'image' && (
        <>
          <MediaInput label="Imagen de fondo" value={value.image.path} onChange={(path) => set({ image: { ...value.image, path } })} aspect="16 / 9" width={140} />
          <SelectInput label="Posición" value={value.image.position} onChange={(position) => set({ image: { ...value.image, position } })} options={[{ value: 'center', label: 'Centro' }, { value: 'top', label: 'Arriba' }, { value: 'bottom', label: 'Abajo' }, { value: 'left', label: 'Izquierda' }, { value: 'right', label: 'Derecha' }]} />
          <Advanced title="Ajustes de imagen">
            <Segmented label="Tamaño" value={value.image.size} onChange={(size) => set({ image: { ...value.image, size } })} options={[{ value: 'cover', label: 'Cubrir' }, { value: 'contain', label: 'Contener' }, { value: 'auto', label: 'Original' }]} />
            <SwitchRow label="Repetir (mosaico)" checked={value.image.repeat} onChange={(repeat) => set({ image: { ...value.image, repeat } })} />
            <SliderInput label="Opacidad de la imagen" value={value.image.opacity} min={0} max={100} format={(v) => `${v}%`} onChange={(opacity) => set({ image: { ...value.image, opacity } })} />
          </Advanced>
        </>
      )}

      {value.type === 'pattern' && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75 }}>
            {PATTERN_IDS.map((id) => {
              const { svg, size } = patternSvg(id, '#333333', 0.55, 0.8);
              return (
                <Tooltip key={id} title={PATTERNS[id].label}>
                  <ButtonBase
                    onClick={() => set({ pattern: { ...value.pattern, id } })}
                    aria-label={PATTERNS[id].label}
                    sx={{
                      height: 44,
                      borderRadius: 1,
                      border: 2,
                      borderColor: value.pattern.id === id ? 'primary.main' : 'divider',
                      backgroundColor: '#fafafa',
                      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
                      backgroundSize: `${size}px ${size}px`,
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
          <ColorInput label="Color del patrón" value={value.pattern.color} onChange={(color) => set({ pattern: { ...value.pattern, color } })} />
          <SliderInput label="Intensidad" value={value.pattern.opacity} min={2} max={60} format={(v) => `${v}%`} onChange={(opacity) => set({ pattern: { ...value.pattern, opacity } })} />
          <SliderInput label="Escala" value={value.pattern.scale} min={0.5} max={3} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(scale) => set({ pattern: { ...value.pattern, scale } })} />
        </>
      )}

      {(value.type === 'image' || value.type === 'gradient' || value.type === 'pattern') && (
        <>
          <ColorInput label="Color del overlay" value={value.overlay.color} onChange={(color) => set({ overlay: { ...value.overlay, color } })} />
          <SliderInput label="Overlay (oscurecer/aclarar)" value={value.overlay.opacity} min={0} max={90} format={(v) => `${v}%`} onChange={(opacity) => set({ overlay: { ...value.overlay, opacity } })} />
        </>
      )}
    </Stack>
  );
}

export function NumberAdornment({ children }: { children: ReactNode }) {
  return <InputAdornment position="end">{children}</InputAdornment>;
}
