'use client';

import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { Store, Trash2 } from 'lucide-react';
import { useFieldArray, useFormState, type Control } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { MAX_BRANCHES, type OrderSettings } from '@/lib/catalog/settings';

/**
 * Sucursales: nombre, WhatsApp y dirección de cada una. Con dos o más, el
 * cliente elige a cuál pide y el mensaje llega al WhatsApp de esa sucursal.
 */
export function BranchesField({ control }: { control: Control<OrderSettings> }) {
  const t = useT();
  const { fields, append, remove } = useFieldArray({ control, name: 'branches' });
  const { errors } = useFormState({ control, name: 'branches' });
  const listError = errors.branches?.root?.message ?? errors.branches?.message;

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2">{t('Sucursales')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('Opcional: si tienes varias, tu cliente elige a cuál pide y el pedido llega al WhatsApp de esa sucursal. Sin sucursales, llega al WhatsApp del negocio.')}
        </Typography>
      </Box>
      {fields.length > 0 && (
        <Stack spacing={1} role="list" aria-label={t('Sucursales')}>
          {fields.map((field, index) => (
            <Stack key={field.id} role="listitem" direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'flex-start' }, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              <TextFieldControl control={control} name={`branches.${index}.name`} label={t('Sucursal')} placeholder={t('Centro')} size="small" sx={{ flex: 1 }} />
              <TextFieldControl control={control} name={`branches.${index}.whatsapp`} label="WhatsApp" placeholder="+52 55 1234 5678" size="small" inputMode="tel" sx={{ flex: 1 }} />
              <TextFieldControl control={control} name={`branches.${index}.address`} label={t('Dirección')} size="small" sx={{ flex: 1.6 }} />
              <IconButton size="small" onClick={() => remove(index)} aria-label={t('Quitar la sucursal {index}', { index: index + 1 })} sx={{ alignSelf: { xs: 'flex-end', md: 'center' } }}>
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
        <Button size="small" startIcon={<Store size={15} />} disabled={fields.length >= MAX_BRANCHES} onClick={() => append({ name: '', whatsapp: '', address: '' }, { shouldFocus: true })}>
          {t('Agregar sucursal')}
        </Button>
      </Box>
    </Stack>
  );
}
