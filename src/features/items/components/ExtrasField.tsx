'use client';

import { Alert, Box, Button, IconButton, InputAdornment, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useFormState, useWatch, type Control } from 'react-hook-form';
import { SwitchControl, TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { MAX_EXTRA_OPTIONS } from '@/lib/catalog/item-attributes';
import type { ItemFormValues } from '../schema';

/**
 * Extras opcionales (Shot extra +$12, Leche de almendra +$8) y el horario del
 * día en que se puede pedir el producto (desayunos de 7:00 a 12:00).
 */
export function ExtrasField({ control }: { control: Control<ItemFormValues> }) {
  const t = useT();
  const enabled = useWatch({ control, name: 'extrasEnabled' });
  const { fields, append, remove } = useFieldArray({ control, name: 'extras' });
  const { errors } = useFormState({ control, name: 'extras' });
  const newExtra = () => ({ id: crypto.randomUUID().slice(0, 8), name: '', price: '', available: true });
  const listError = errors.extras?.root?.message ?? errors.extras?.message;

  return (
    <Stack spacing={2}>
      <SwitchControl
        control={control}
        name="extrasEnabled"
        label={t('Tiene extras')}
        description={t('Complementos que el cliente puede sumar al pedir, con su precio (o gratis).')}
        onChange={(on) => on && fields.length === 0 && append([newExtra(), newExtra()], { shouldFocus: false })}
      />
      {enabled && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextFieldControl control={control} name="extrasLabel" label={t('Título')} placeholder={t('Extras')} sx={{ maxWidth: { sm: 220 } }} />
            <TextFieldControl control={control} name="extrasMax" label={t('Máximo a elegir')} placeholder={t('Sin límite')} inputMode="numeric" sx={{ maxWidth: { sm: 160 } }} />
          </Stack>
          <Stack spacing={1} role="list" aria-label={t('Extras')}>
            {fields.map((field, index) => (
              <Stack key={field.id} role="listitem" direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                <TextFieldControl control={control} name={`extras.${index}.name`} label={t('Extra')} placeholder={t('Shot extra')} size="small" sx={{ flex: 2 }} />
                <TextFieldControl
                  control={control}
                  name={`extras.${index}.price`}
                  label={t('Precio')}
                  placeholder="0"
                  inputMode="decimal"
                  size="small"
                  sx={{ flex: 1 }}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">+$</InputAdornment> } }}
                />
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Controller
                    control={control}
                    name={`extras.${index}.available`}
                    render={({ field: available }) => (
                      <Tooltip title={available.value ? t('Disponible') : t('Agotado')}>
                        <Switch size="small" checked={available.value} onChange={(event) => available.onChange(event.target.checked)} slotProps={{ input: { 'aria-label': t('Extra {index} disponible', { index: index + 1 }) } }} />
                      </Tooltip>
                    )}
                  />
                  <IconButton size="small" onClick={() => remove(index)} aria-label={t('Quitar el extra {index}', { index: index + 1 })}>
                    <Trash2 size={15} />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
          {listError && <Alert severity="error">{t(listError)}</Alert>}
          <Box>
            <Button startIcon={<Plus size={15} />} onClick={() => append(newExtra())} disabled={fields.length >= MAX_EXTRA_OPTIONS}>
              {t('Agregar extra')}
            </Button>
          </Box>
        </>
      )}
    </Stack>
  );
}

/** "Sólo se puede pedir de 7:00 a 12:00" (en la zona horaria del horario del negocio). */
export function OrderHoursField({ control }: { control: Control<ItemFormValues> }) {
  const t = useT();
  const enabled = useWatch({ control, name: 'orderHoursEnabled' });
  return (
    <Stack spacing={1.5}>
      <SwitchControl control={control} name="orderHoursEnabled" label={t('Sólo en un horario')} description={t('Por ejemplo, desayunos: fuera de ese horario se ve, pero no se puede pedir.')} />
      {enabled && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          {(['orderHoursFrom', 'orderHoursTo'] as const).map((name) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field, fieldState }) => (
                <TextField
                  type="time"
                  size="small"
                  label={name === 'orderHoursFrom' ? t('Desde') : t('Hasta')}
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                  sx={{ width: 150 }}
                />
              )}
            />
          ))}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('Se usa la zona horaria de tu horario por día (Contacto).')}
      </Typography>
    </Stack>
  );
}
