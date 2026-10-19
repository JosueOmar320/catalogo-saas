'use client';

import { Autocomplete, Chip, Grid, InputAdornment, MenuItem, TextField } from '@mui/material';
import { useT } from '@/i18n/client';
import type { AttributeDef, AttributeValue } from '@/lib/catalog/attributes';

type Values = Record<string, AttributeValue>;

/**
 * Campos de los atributos personalizados del negocio (Marca, Material,
 * Duración…). Cada tipo tiene su control; vacío = sin valor.
 */
export function ItemAttributesFields({ defs, value, onChange }: { defs: AttributeDef[]; value: Values; onChange: (value: Values) => void }) {
  const t = useT();
  const set = (id: string, v: AttributeValue | null) => {
    const next = { ...value };
    if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) delete next[id];
    else next[id] = v;
    onChange(next);
  };

  return (
    <Grid container spacing={2}>
      {defs.map((def) => {
        const current = value[def.id];
        const wide = def.type === 'list';
        let field: React.ReactNode;
        switch (def.type) {
          case 'number':
            field = (
              <TextField
                fullWidth
                type="number"
                label={def.name}
                value={typeof current === 'number' ? current : ''}
                onChange={(e) => set(def.id, e.target.value === '' ? null : Number(e.target.value))}
                slotProps={{ input: def.unit ? { endAdornment: <InputAdornment position="end">{def.unit}</InputAdornment> } : undefined }}
              />
            );
            break;
          case 'select':
            field = (
              <TextField select fullWidth label={def.name} value={typeof current === 'string' ? current : ''} onChange={(e) => set(def.id, e.target.value || null)}>
                <MenuItem value="">
                  <em>{t('Sin valor')}</em>
                </MenuItem>
                {def.options.map((o) => (
                  <MenuItem key={o} value={o}>{o}</MenuItem>
                ))}
              </TextField>
            );
            break;
          case 'boolean':
            field = (
              <TextField select fullWidth label={def.name} value={typeof current === 'boolean' ? String(current) : ''} onChange={(e) => set(def.id, e.target.value === '' ? null : e.target.value === 'true')}>
                <MenuItem value="">
                  <em>{t('Sin valor')}</em>
                </MenuItem>
                <MenuItem value="true">{t('Sí')}</MenuItem>
                <MenuItem value="false">{t('No')}</MenuItem>
              </TextField>
            );
            break;
          case 'list':
            field = (
              <Autocomplete
                multiple
                freeSolo
                options={def.options}
                value={Array.isArray(current) ? current : []}
                onChange={(_, v) => set(def.id, (v as string[]).map((x) => x.trim()).filter(Boolean).slice(0, 20))}
                renderValue={(list, getItemProps) =>
                  list.map((option, index) => {
                    const { key, ...rest } = getItemProps({ index });
                    return <Chip key={key} label={option} size="small" {...rest} />;
                  })
                }
                renderInput={(params) => <TextField {...params} label={def.name} placeholder={t('Escribe y presiona Enter')} />}
              />
            );
            break;
          default:
            field = (
              <TextField
                fullWidth
                label={def.name}
                value={typeof current === 'string' ? current : ''}
                onChange={(e) => set(def.id, e.target.value)}
                slotProps={{ htmlInput: { maxLength: 200 }, input: def.unit ? { endAdornment: <InputAdornment position="end">{def.unit}</InputAdornment> } : undefined }}
              />
            );
        }
        return (
          <Grid key={def.id} size={{ xs: 12, sm: wide ? 12 : 6 }}>
            {field}
          </Grid>
        );
      })}
    </Grid>
  );
}
