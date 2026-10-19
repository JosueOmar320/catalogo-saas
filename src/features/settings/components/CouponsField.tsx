'use client';

import { Box, Button, IconButton, InputAdornment, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useFormState, type Control } from 'react-hook-form';
import { SelectControl, TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { MAX_COUPONS, type OrderSettings } from '@/lib/catalog/settings';

/**
 * Cupones del pedido por WhatsApp: código, porcentaje o monto, mínimo,
 * último día y si está activo. El cliente lo escribe en el panel del pedido.
 */
export function CouponsField({ control }: { control: Control<OrderSettings> }) {
  const t = useT();
  const { fields, append, remove } = useFieldArray({ control, name: 'coupons' });
  const { errors } = useFormState({ control, name: 'coupons' });
  const listError = errors.coupons?.root?.message ?? errors.coupons?.message;

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2">{t('Cupones de descuento')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('Tus clientes escriben el código al pedir y el descuento aparece en el mensaje. Los códigos no se ven en tu sitio.')}
        </Typography>
      </Box>
      {fields.length > 0 && (
        <Stack spacing={1} role="list" aria-label={t('Cupones de descuento')}>
          {fields.map((field, index) => (
            <Stack key={field.id} role="listitem" direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'flex-start' }, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              <TextFieldControl control={control} name={`coupons.${index}.code`} label={t('Código')} size="small" placeholder="VERANO10" sx={{ flex: 1.3 }} slotProps={{ htmlInput: { style: { textTransform: 'uppercase' } } }} />
              <SelectControl
                control={control}
                name={`coupons.${index}.type`}
                label={t('Descuento')}
                size="small"
                options={[
                  { value: 'percent', label: t('Porcentaje') },
                  { value: 'amount', label: t('Monto fijo') },
                ]}
                sx={{ flex: 1 }}
              />
              <TextFieldControl control={control} name={`coupons.${index}.value`} label={t('Valor')} size="small" inputMode="decimal" sx={{ flex: 0.8 }} />
              <TextFieldControl
                control={control}
                name={`coupons.${index}.minSubtotal`}
                label={t('Compra mínima')}
                size="small"
                inputMode="decimal"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                sx={{ flex: 1 }}
              />
              <Controller
                control={control}
                name={`coupons.${index}.ends`}
                render={({ field: ends }) => (
                  <TextField
                    type="date"
                    size="small"
                    label={t('Válido hasta')}
                    value={ends.value?.on ?? ''}
                    // La fecha se entiende en la zona horaria de quien la programa.
                    onChange={(event) => ends.onChange(event.target.value ? { on: event.target.value, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : null)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ flex: 1.1 }}
                  />
                )}
              />
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Controller
                  control={control}
                  name={`coupons.${index}.active`}
                  render={({ field: active }) => (
                    <Tooltip title={active.value ? t('Activo') : t('Pausado')}>
                      <Switch checked={active.value} onChange={(event) => active.onChange(event.target.checked)} slotProps={{ input: { 'aria-label': t('Cupón {index} activo', { index: index + 1 }) } }} />
                    </Tooltip>
                  )}
                />
                <IconButton size="small" onClick={() => remove(index)} aria-label={t('Quitar el cupón {index}', { index: index + 1 })}>
                  <Trash2 size={15} />
                </IconButton>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
      {listError && (
        <Typography variant="caption" color="error">
          {t(listError)}
        </Typography>
      )}
      <Box>
        <Button
          size="small"
          startIcon={<Plus size={15} />}
          disabled={fields.length >= MAX_COUPONS}
          onClick={() => append({ code: '', type: 'percent', value: 10, minSubtotal: null, ends: null, active: true }, { shouldFocus: true })}
        >
          {t('Agregar cupón')}
        </Button>
      </Box>
    </Stack>
  );
}
