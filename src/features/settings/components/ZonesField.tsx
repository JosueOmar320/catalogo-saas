'use client';

import { Box, Button, IconButton, InputAdornment, Stack, Typography } from '@mui/material';
import { MapPin, Trash2 } from 'lucide-react';
import { useFieldArray, useFormState, type Control } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { MAX_ZONES, type OrderSettings } from '@/lib/catalog/settings';

/**
 * Zonas de entrega: nombre, costo de envío y pedido mínimo de cada una. Con
 * alguna, el cliente elige su zona al pedir a domicilio.
 */
export function ZonesField({ control }: { control: Control<OrderSettings> }) {
  const t = useT();
  const { fields, append, remove } = useFieldArray({ control, name: 'zones' });
  const { errors } = useFormState({ control, name: 'zones' });
  const listError = errors.zones?.root?.message ?? errors.zones?.message;
  const money = { input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } };

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2">{t('Zonas de entrega')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('Opcional: con zonas, tu cliente elige la suya y paga su envío (en lugar del costo de envío general). El envío gratis desde un monto aplica a todas.')}
        </Typography>
      </Box>
      {fields.length > 0 && (
        <Stack spacing={1} role="list" aria-label={t('Zonas de entrega')}>
          {fields.map((field, index) => (
            <Stack key={field.id} role="listitem" direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'flex-start' }, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              <TextFieldControl control={control} name={`zones.${index}.name`} label={t('Zona')} size="small" placeholder={t('Centro')} sx={{ flex: 1.4 }} />
              <TextFieldControl control={control} name={`zones.${index}.fee`} label={t('Envío')} size="small" inputMode="decimal" slotProps={money} helperText={t('Vacío: por confirmar')} sx={{ flex: 1 }} />
              <TextFieldControl control={control} name={`zones.${index}.minimumOrder`} label={t('Pedido mínimo')} size="small" inputMode="decimal" slotProps={money} sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => remove(index)} aria-label={t('Quitar la zona {index}', { index: index + 1 })} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                <Trash2 size={15} />
              </IconButton>
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
        <Button size="small" startIcon={<MapPin size={15} />} disabled={fields.length >= MAX_ZONES} onClick={() => append({ name: '', fee: null, minimumOrder: null }, { shouldFocus: true })}>
          {t('Agregar zona')}
        </Button>
      </Box>
    </Stack>
  );
}
