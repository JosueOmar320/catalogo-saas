'use client';

import { Box, Button, IconButton, InputAdornment, Stack, Switch, Tooltip, Typography } from '@mui/material';
import { BadgePercent, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useFormState, type Control } from 'react-hook-form';
import { SelectControl, TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { MAX_PROMOTIONS, type OrderSettings } from '@/lib/catalog/settings';

/**
 * Promociones automáticas (sin código): "10 % desde $300", "$50 menos desde
 * $500". Se aplica sola la que más descuenta; el pedido avisa cuánto falta.
 */
export function PromotionsField({ control }: { control: Control<OrderSettings> }) {
  const t = useT();
  const { fields, append, remove } = useFieldArray({ control, name: 'promotions' });
  const { errors } = useFormState({ control, name: 'promotions' });
  const listError = errors.promotions?.root?.message ?? errors.promotions?.message;
  const money = { input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } };

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2">{t('Promociones automáticas')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('Sin código: se aplican solas desde cierto monto y el pedido avisa cuánto falta. No se suman a un cupón: vale el descuento mayor.')}
        </Typography>
      </Box>
      {fields.length > 0 && (
        <Stack spacing={1} role="list" aria-label={t('Promociones automáticas')}>
          {fields.map((field, index) => (
            <Stack key={field.id} role="listitem" direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'flex-start' }, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              <SelectControl
                control={control}
                name={`promotions.${index}.type`}
                label={t('Descuento')}
                size="small"
                options={[
                  { value: 'percent', label: t('Porcentaje') },
                  { value: 'amount', label: t('Monto fijo') },
                ]}
                sx={{ flex: 1 }}
              />
              <TextFieldControl control={control} name={`promotions.${index}.value`} label={t('Valor')} size="small" inputMode="decimal" sx={{ flex: 0.8 }} />
              <TextFieldControl control={control} name={`promotions.${index}.minSubtotal`} label={t('Desde (compra)')} size="small" inputMode="decimal" slotProps={money} sx={{ flex: 1 }} />
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Controller
                  control={control}
                  name={`promotions.${index}.active`}
                  render={({ field: active }) => (
                    <Tooltip title={active.value ? t('Activa') : t('Pausada')}>
                      <Switch checked={active.value} onChange={(event) => active.onChange(event.target.checked)} slotProps={{ input: { 'aria-label': t('Promoción {index} activa', { index: index + 1 }) } }} />
                    </Tooltip>
                  )}
                />
                <IconButton size="small" onClick={() => remove(index)} aria-label={t('Quitar la promoción {index}', { index: index + 1 })}>
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
        <Button size="small" startIcon={<BadgePercent size={15} />} disabled={fields.length >= MAX_PROMOTIONS} onClick={() => append({ type: 'percent', value: 10, minSubtotal: 300, active: true }, { shouldFocus: true })}>
          {t('Agregar promoción')}
        </Button>
      </Box>
    </Stack>
  );
}
