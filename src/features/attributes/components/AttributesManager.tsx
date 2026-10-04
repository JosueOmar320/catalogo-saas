'use client';

import { Alert, Autocomplete, Box, Button, Chip, Collapse, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '@/components/ui/SectionCard';
import { SortableList } from '@/components/ui/SortableList';
import { ATTRIBUTE_TYPE_LABELS, ATTRIBUTE_TYPES, attributeIdFromName, type AttributeDef, type AttributeType } from '@/lib/catalog/attributes';
import { useAction } from '@/lib/hooks/use-action';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes';
import { saveAttributeDefs } from '../actions';

/** Sugerencias genéricas (no atadas a una industria): el usuario puede crear cualquiera. */
const SUGGESTIONS: { name: string; type: AttributeType; unit?: string }[] = [
  { name: 'Marca', type: 'select' },
  { name: 'Modelo', type: 'text' },
  { name: 'Material', type: 'select' },
  { name: 'Color', type: 'list' },
  { name: 'Tamaño', type: 'text' },
  { name: 'Peso', type: 'number', unit: 'kg' },
  { name: 'Duración', type: 'number', unit: 'min' },
  { name: 'Modalidad', type: 'select' },
  { name: 'Incluye', type: 'list' },
  { name: 'Garantía', type: 'text' },
];

type Props = { initial: AttributeDef[]; usage: Record<string, number> };

export function AttributesManager({ initial, usage }: Props) {
  const [defs, setDefs] = useState<AttributeDef[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [open, setOpen] = useState<string | null>(null);
  const { run, pending } = useAction();
  const dirty = JSON.stringify(defs) !== saved;
  useUnsavedChangesWarning(dirty);

  const update = (id: string, patch: Partial<AttributeDef>) => setDefs((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const add = (name: string, type: AttributeType = 'text', unit = '') => {
    const def: AttributeDef = {
      id: attributeIdFromName(name, defs.map((d) => d.id)),
      name,
      type,
      unit,
      options: [],
      filterable: type === 'select' || type === 'boolean',
      showInCard: false,
      showInDetail: true,
      showInPdf: true,
    };
    setDefs((list) => [...list, def]);
    setOpen(def.id);
  };
  const unused = SUGGESTIONS.filter((s) => !defs.some((d) => d.name.toLowerCase() === s.name.toLowerCase()));

  return (
    <Stack spacing={2.5}>
      <SectionCard
        title="Atributos del catálogo"
        description="Datos propios de tus ítems: se completan en cada producto o servicio y se usan en tarjetas, fichas, filtros del sitio y tablas comparativas del PDF."
        action={
          <Button variant="contained" disabled={!dirty || pending} onClick={() => run(() => saveAttributeDefs(defs), { onSuccess: () => setSaved(JSON.stringify(defs)) })}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        }
      >
        <Stack spacing={2} sx={{ pb: 2 }}>
          {defs.length === 0 ? (
            <Alert severity="info">Aún no tienes atributos. Agrega uno de las sugerencias o crea el tuyo.</Alert>
          ) : (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
              <SortableList
                items={defs}
                getId={(d) => d.id}
                onReorder={setDefs}
                renderItem={(def) => (
                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setOpen(open === def.id ? null : def.id)}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {def.name || 'Sin nombre'}
                          {def.unit && <Typography component="span" variant="body2" color="text.secondary"> ({def.unit})</Typography>}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ATTRIBUTE_TYPE_LABELS[def.type]}
                          {usage[def.id] ? ` · en ${usage[def.id]} ítem${usage[def.id] === 1 ? '' : 's'}` : ''}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                        {def.filterable && <Chip size="small" label="Filtro" />}
                        {def.showInCard && <Chip size="small" label="Tarjeta" />}
                        {def.showInPdf && <Chip size="small" label="PDF" />}
                      </Stack>
                      <IconButton size="small" onClick={() => setOpen(open === def.id ? null : def.id)} aria-label="Editar" sx={{ transform: open === def.id ? 'rotate(180deg)' : 'none' }}>
                        <ChevronDown size={16} />
                      </IconButton>
                    </Stack>
                    <Collapse in={open === def.id} unmountOnExit>
                      <AttributeEditor
                        def={def}
                        used={usage[def.id] ?? 0}
                        onChange={(patch) => update(def.id, patch)}
                        onRemove={() => setDefs((list) => list.filter((d) => d.id !== def.id))}
                      />
                    </Collapse>
                  </Box>
                )}
              />
            </Box>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
              Sugerencias
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {unused.map((s) => (
                <Chip key={s.name} label={s.name} icon={<Plus size={14} />} variant="outlined" onClick={() => add(s.name, s.type, s.unit)} />
              ))}
              <Chip label="Otro atributo" icon={<Plus size={14} />} color="primary" variant="outlined" onClick={() => add('Nuevo atributo')} />
            </Stack>
          </Box>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function AttributeEditor({ def, used, onChange, onRemove }: { def: AttributeDef; used: number; onChange: (patch: Partial<AttributeDef>) => void; onRemove: () => void }) {
  const toggle = (key: 'filterable' | 'showInCard' | 'showInDetail' | 'showInPdf', label: string) => (
    <FormControlLabel control={<Switch size="small" checked={def[key]} onChange={(e) => onChange({ [key]: e.target.checked })} />} label={<Typography variant="body2">{label}</Typography>} />
  );
  return (
    <Stack spacing={2} sx={{ pt: 2, pb: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField label="Nombre" value={def.name} onChange={(e) => onChange({ name: e.target.value })} slotProps={{ htmlInput: { maxLength: 40 } }} sx={{ flex: 2 }} />
        <TextField
          select
          label="Tipo"
          value={def.type}
          onChange={(e) => onChange({ type: e.target.value as AttributeType })}
          helperText={used ? 'Cambiarlo puede ocultar valores ya cargados.' : undefined}
          sx={{ flex: 1.4 }}
        >
          {ATTRIBUTE_TYPES.map((t) => (
            <MenuItem key={t} value={t}>{ATTRIBUTE_TYPE_LABELS[t]}</MenuItem>
          ))}
        </TextField>
        {(def.type === 'number' || def.type === 'text') && <TextField label="Unidad" placeholder="kg, cm, min…" value={def.unit} onChange={(e) => onChange({ unit: e.target.value })} slotProps={{ htmlInput: { maxLength: 12 } }} sx={{ flex: 0.8 }} />}
      </Stack>
      {(def.type === 'select' || def.type === 'list') && (
        <Autocomplete
          multiple
          freeSolo
          options={[]}
          value={def.options}
          onChange={(_, v) => onChange({ options: (v as string[]).map((x) => x.trim()).filter(Boolean).slice(0, 40) })}
          renderValue={(list, getItemProps) =>
            list.map((option, index) => {
              const { key, ...rest } = getItemProps({ index });
              return <Chip key={key} label={option} size="small" {...rest} />;
            })
          }
          renderInput={(params) => (
            <TextField {...params} label={def.type === 'select' ? 'Opciones' : 'Sugerencias (opcional)'} placeholder="Escribe y presiona Enter" helperText={def.type === 'select' ? 'El ítem elige una. También son los valores del filtro.' : 'El ítem puede tener varios valores (ej. lo que incluye un servicio).'} />
          )}
        />
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {toggle('filterable', 'Se puede filtrar en el sitio')}
        {toggle('showInCard', 'Mostrar en las tarjetas')}
        {toggle('showInDetail', 'Mostrar en la ficha del ítem')}
        {toggle('showInPdf', 'Mostrar en el PDF')}
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">Identificador: {def.id}</Typography>
        <Tooltip title={used ? 'Los valores cargados se conservan pero dejan de mostrarse.' : ''}>
          <Button color="error" size="small" startIcon={<Trash2 size={14} />} onClick={onRemove}>Quitar atributo</Button>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
