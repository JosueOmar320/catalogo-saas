'use client';

import { Alert, Box, Button, IconButton, InputAdornment, Stack, Switch, Tooltip, Typography } from '@mui/material';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Controller, useController, useFieldArray, useFormState, useWatch, type Control } from 'react-hook-form';
import { SwitchControl, TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { MAX_VARIANT_OPTIONS } from '@/lib/catalog/item-attributes';
import type { ItemFormValues } from '../schema';

const SUGGESTIONS = [msg('Tamaño'), msg('Talla'), msg('Sabor'), msg('Color'), msg('Formato')];

/**
 * Opciones del producto (un grupo: Tamaño → Chico / Mediano / Grande), cada
 * una con precio, código y disponibilidad. Sin precio usa el del producto.
 */
export function VariantsField({ control, basePrice }: { control: Control<ItemFormValues>; basePrice: string }) {
  const t = useT();
  const enabled = useWatch({ control, name: 'variantsEnabled' });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'variants' });
  const { errors } = useFormState({ control, name: 'variants' });
  const newOption = () => ({ id: crypto.randomUUID().slice(0, 8), name: '', price: '', sku: '', available: true });

  return (
    <Stack spacing={2}>
      <SwitchControl
        control={control}
        name="variantsEnabled"
        label={t('Tiene opciones')}
        description={t('Tamaños, tallas, sabores o colores con su propio precio. El cliente elige una al pedir.')}
        // Al encenderlas por primera vez, dos filas listas para escribir.
        onChange={(on) => on && fields.length === 0 && append([newOption(), newOption()], { shouldFocus: false })}
      />
      {enabled && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
            <TextFieldControl control={control} name="variantsLabel" label={t('¿Qué eligen?')} placeholder={t('Tamaño')} sx={{ maxWidth: { sm: 220 } }} />
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', pt: { sm: 1 } }}>
              {SUGGESTIONS.map((label) => (
                <VariantLabelChip key={label} control={control} label={t(label)} />
              ))}
            </Stack>
          </Stack>

          <Stack spacing={1} role="list" aria-label={t('Opciones')}>
            {fields.map((field, index) => (
              <Stack key={field.id} role="listitem" direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                <TextFieldControl control={control} name={`variants.${index}.name`} label={t('Opción')} placeholder={t('Grande')} size="small" sx={{ flex: 2 }} />
                <TextFieldControl
                  control={control}
                  name={`variants.${index}.price`}
                  label={t('Precio')}
                  placeholder={basePrice || undefined}
                  inputMode="decimal"
                  size="small"
                  sx={{ flex: 1 }}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                />
                <TextFieldControl control={control} name={`variants.${index}.sku`} label={t('Código')} size="small" sx={{ flex: 1 }} />
                <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                  <AvailableSwitch control={control} index={index} />
                  <Tooltip title={t('Mover arriba')}>
                    <span>
                      <IconButton size="small" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t('Mover arriba')}>
                        <ArrowUp size={15} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('Mover abajo')}>
                    <span>
                      <IconButton size="small" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} aria-label={t('Mover abajo')}>
                        <ArrowDown size={15} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('Quitar')}>
                    <IconButton size="small" onClick={() => remove(index)} aria-label={t('Quitar la opción {index}', { index: index + 1 })}>
                      <Trash2 size={15} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            ))}
          </Stack>
          {errors.variants?.root?.message || errors.variants?.message ? (
            <Alert severity="error">{t((errors.variants?.root?.message ?? errors.variants?.message) as string)}</Alert>
          ) : null}
          <Box>
            <Button startIcon={<Plus size={15} />} onClick={() => append(newOption())} disabled={fields.length >= MAX_VARIANT_OPTIONS}>
              {t('Agregar opción')}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('Una opción sin precio usa el precio del producto. En el catálogo se muestra el menor precio con "desde".')}
          </Typography>
        </>
      )}
    </Stack>
  );
}

function AvailableSwitch({ control, index }: { control: Control<ItemFormValues>; index: number }) {
  const t = useT();
  const name = useWatch({ control, name: `variants.${index}.name` });
  return (
    <Controller
      control={control}
      name={`variants.${index}.available`}
      render={({ field }) => (
        <Tooltip title={field.value ? t('Disponible') : t('Agotada')}>
          <Switch
            size="small"
            checked={field.value}
            onChange={(event) => field.onChange(event.target.checked)}
            slotProps={{ input: { 'aria-label': t('Disponible: {name}', { name: name || t('opción {index}', { index: index + 1 }) }) } }}
          />
        </Tooltip>
      )}
    />
  );
}

function VariantLabelChip({ control, label }: { control: Control<ItemFormValues>; label: string }) {
  const { field } = useController({ control, name: 'variantsLabel' });
  return (
    <Button size="small" variant={field.value === label ? 'contained' : 'outlined'} color="inherit" onClick={() => field.onChange(label)} sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 12 }}>
      {label}
    </Button>
  );
}
