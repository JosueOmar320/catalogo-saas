'use client';

import { Alert, Box, Button, IconButton, InputAdornment, Stack, Typography } from '@mui/material';
import { Layers, Trash2 } from 'lucide-react';
import { useFieldArray, useFormState, type Control } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { MAX_PRICE_TIERS } from '@/lib/catalog/item-attributes';
import type { ItemFormValues } from '../schema';

/**
 * Precios por mayoreo: desde N piezas, otro precio por unidad (12+ a $38 c/u).
 * El pedido aplica el que alcance la cantidad de la línea.
 */
export function TiersField({ control }: { control: Control<ItemFormValues> }) {
  const t = useT();
  const { fields, append, remove } = useFieldArray({ control, name: 'tiers' });
  const { errors } = useFormState({ control, name: 'tiers' });
  const listError = errors.tiers?.root?.message ?? errors.tiers?.message;

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {t('Opcional: a partir de cierta cantidad, cada pieza cuesta menos. Se muestra en la ficha y el pedido lo aplica solo (hasta 99 piezas por producto).')}
      </Typography>
      {fields.length > 0 && (
        <Stack spacing={1} role="list" aria-label={t('Precios por mayoreo')}>
          {fields.map((field, index) => (
            <Stack key={field.id} role="listitem" direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <TextFieldControl
                control={control}
                name={`tiers.${index}.minQty`}
                label={t('Desde (piezas)')}
                placeholder="12"
                inputMode="numeric"
                size="small"
                sx={{ flex: 1 }}
              />
              <TextFieldControl
                control={control}
                name={`tiers.${index}.price`}
                label={t('Precio c/u')}
                inputMode="decimal"
                size="small"
                sx={{ flex: 1 }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
              />
              <IconButton size="small" onClick={() => remove(index)} aria-label={t('Quitar el precio por mayoreo {index}', { index: index + 1 })} sx={{ mt: 0.75 }}>
                <Trash2 size={15} />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}
      {listError && <Alert severity="error">{t(listError)}</Alert>}
      <Box>
        <Button startIcon={<Layers size={15} />} onClick={() => append({ minQty: '', price: '' })} disabled={fields.length >= MAX_PRICE_TIERS}>
          {t('Agregar precio por mayoreo')}
        </Button>
      </Box>
    </Stack>
  );
}
