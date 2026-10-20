'use client';

import { Box, ButtonBase, InputAdornment, TextField, Tooltip } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { formatPrice } from '@/lib/utils/format';
import { parsePriceCell } from '@/lib/catalog/csv';
import { setItemPrice } from '../actions';
import type { ItemRowData } from './ItemsTable';

/**
 * Precio de la lista que se edita en el lugar: clic (o Enter), escribir y
 * Enter para guardar; Esc cancela. Vacío = sin precio ("a consultar").
 */
export function PriceCell({ item, locale, onSaved }: { item: Pick<ItemRowData, 'id' | 'name' | 'price' | 'priceLabel' | 'currency'>; locale: string; onSaved: (price: number | null, label: string | null) => void }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  // Enter guarda y el campo pierde el foco (onBlur): se guarda una sola vez.
  const saving = useRef(false);

  const start = () => {
    setValue(item.price === null ? '' : String(item.price));
    setError(false);
    setEditing(true);
  };
  const save = async () => {
    if (saving.current) return;
    // "1,200.50", "1.200,50", "$ 48": mismo criterio que la importación CSV.
    const parsed = parsePriceCell(value);
    if (parsed !== null && Number.isNaN(parsed)) return setError(true);
    if (parsed === item.price) return setEditing(false);
    saving.current = true;
    const result = await run(() => setItemPrice({ id: item.id, price: parsed }));
    saving.current = false;
    if (!result?.ok) return;
    onSaved(parsed, parsed === null ? null : formatPrice(parsed, item.currency, locale));
    setEditing(false);
    router.refresh();
  };

  if (editing) {
    return (
      <TextField
        size="small"
        autoFocus
        value={value}
        disabled={pending}
        error={error}
        onChange={(event) => {
          setValue(event.target.value);
          setError(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save();
          if (event.key === 'Escape') setEditing(false);
        }}
        onBlur={() => void save()}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
          htmlInput: { inputMode: 'decimal', 'aria-label': t('Precio de {name}', { name: item.name }) },
        }}
        sx={{ width: 120, display: { xs: 'none', sm: 'inline-flex' } }}
      />
    );
  }
  return (
    <Tooltip title={t('Clic para cambiar el precio')}>
      <ButtonBase
        onClick={start}
        aria-label={t('Cambiar el precio de {name}: {price}', { name: item.name, price: item.priceLabel ?? t('sin precio') })}
        sx={{ width: 96, justifyContent: 'flex-end', display: { xs: 'none', sm: 'flex' }, borderRadius: 1, px: 0.5, py: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box component="span" sx={{ typography: 'body2', fontVariantNumeric: 'tabular-nums', borderBottom: 1, borderColor: 'divider', borderBottomStyle: 'dashed' }}>
          {item.priceLabel ?? '—'}
        </Box>
      </ButtonBase>
    </Tooltip>
  );
}
