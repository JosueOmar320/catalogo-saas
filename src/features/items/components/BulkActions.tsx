'use client';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { ArrowRight, ChevronDown, Eye, FolderInput, PackageCheck, Percent, Star, Tags, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';
import { adjustPrice, isValidAdjustment, MAX_PERCENT, MIN_PERCENT, type PriceAdjustment, type PriceRounding } from '@/lib/catalog/price-adjust';
import { formatPrice } from '@/lib/utils/format';
import type { BulkItemsInput } from '../actions';
import { labelsHtml } from '../labels';

type Row = { id: string; name: string; price: number | null; priceLabel: string | null; currency: string; url: string; /** Costo privado (para avisar si un ajuste queda por debajo). */ cost: number | null };

type Props = {
  selected: Row[];
  categories: { id: string; name: string }[];
  locale: string;
  businessName: string;
  pending: boolean;
  onAction: (action: BulkItemsInput['action']) => void;
  onClear: () => void;
};

/** Barra que aparece al seleccionar ítems: visibilidad, disponibilidad, destacados, categoría, precios y eliminar. */
export function BulkActions({ selected, categories, locale, businessName, pending, onAction, onClear }: Props) {
  const t = useT();
  const [priceOpen, setPriceOpen] = useState(false);
  const count = selected.length;
  /** Hoja para imprimir: nombre, precio y QR a la ficha de cada seleccionado. */
  const printLabels = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      labelsHtml({
        items: selected.map((row) => ({ name: row.name, priceLabel: row.priceLabel, url: row.url })),
        businessName,
        title: t('Etiquetas con QR'),
        scanText: t('Escanea para ver y pedir'),
        lang: document.documentElement.lang,
      }),
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Paper
      elevation={0}
      role="toolbar"
      aria-label={t('Acciones para los ítems seleccionados')}
      sx={{ position: 'sticky', top: 64, zIndex: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, py: 1, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 1.5, mb: 1.5 }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, mr: 'auto' }} aria-live="polite">
        {count === 1 ? t('1 seleccionado') : t('{count} seleccionados', { count })}
      </Typography>
      <ActionMenu
        icon={<Eye size={14} />}
        label={t('Visibilidad')}
        disabled={pending}
        options={[
          { label: t('Mostrar en el catálogo'), onClick: () => onAction({ type: 'set', field: 'is_visible', value: true }) },
          { label: t('Ocultar del catálogo'), onClick: () => onAction({ type: 'set', field: 'is_visible', value: false }) },
        ]}
      />
      <ActionMenu
        icon={<PackageCheck size={14} />}
        label={t('Disponibilidad')}
        disabled={pending}
        options={[
          { label: t('Marcar como disponible'), onClick: () => onAction({ type: 'set', field: 'is_available', value: true }) },
          { label: t('Marcar como agotado'), onClick: () => onAction({ type: 'set', field: 'is_available', value: false }) },
        ]}
      />
      <ActionMenu
        icon={<Star size={14} />}
        label={t('Destacados')}
        disabled={pending}
        options={[
          { label: t('Destacar'), onClick: () => onAction({ type: 'set', field: 'is_featured', value: true }) },
          { label: t('Quitar de destacados'), onClick: () => onAction({ type: 'set', field: 'is_featured', value: false }) },
        ]}
      />
      <ActionMenu
        icon={<FolderInput size={14} />}
        label={t('Categoría')}
        disabled={pending}
        options={[
          ...categories.map((c) => ({ label: c.name, onClick: () => onAction({ type: 'category', categoryId: c.id }) })),
          { label: t('Sin categoría'), onClick: () => onAction({ type: 'category', categoryId: null }), divider: categories.length > 0 },
        ]}
      />
      <Button size="small" color="inherit" variant="outlined" startIcon={<Percent size={14} />} disabled={pending} onClick={() => setPriceOpen(true)} sx={{ borderColor: 'currentColor' }}>
        {t('Precios')}
      </Button>
      <Button size="small" color="inherit" variant="outlined" startIcon={<Tags size={14} />} onClick={() => printLabels()} sx={{ borderColor: 'currentColor' }}>
        {t('Etiquetas con QR')}
      </Button>
      <Button size="small" color="inherit" variant="outlined" startIcon={<Trash2 size={14} />} disabled={pending} onClick={() => onAction({ type: 'delete' })} sx={{ borderColor: 'currentColor' }}>
        {t('Eliminar')}
      </Button>
      <Tooltip title={t('Quitar selección')}>
        <IconButton size="small" color="inherit" onClick={onClear}>
          <X size={16} />
        </IconButton>
      </Tooltip>
      {priceOpen && (
        <PriceDialog
          rows={selected}
          locale={locale}
          onClose={() => setPriceOpen(false)}
          onApply={(adjustment) => {
            setPriceOpen(false);
            onAction({ type: 'price', ...adjustment });
          }}
        />
      )}
    </Paper>
  );
}

function ActionMenu({ icon, label, options, disabled }: { icon: ReactNode; label: string; disabled: boolean; options: { label: string; onClick: () => void; divider?: boolean }[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        size="small"
        color="inherit"
        variant="outlined"
        startIcon={icon}
        endIcon={<ChevronDown size={14} />}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        sx={{ borderColor: 'currentColor' }}
      >
        {label}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { maxHeight: 360 } } }}>
        {options.flatMap((option) => [
          ...(option.divider ? [<Divider key={`${option.label}-divider`} />] : []),
          <MenuItem
            key={option.label}
            onClick={() => {
              setAnchor(null);
              option.onClick();
            }}
          >
            {option.label}
          </MenuItem>,
        ])}
      </Menu>
    </>
  );
}

const ROUNDINGS: { id: PriceRounding; label: string }[] = [
  { id: 'none', label: msg('Sin redondear') },
  { id: 'unit', label: msg('A enteros (52)') },
  { id: 'ten', label: msg('A decenas (50)') },
  { id: 'nine', label: msg('Terminar en 9 (49)') },
];

/** Subir o bajar precios por porcentaje o monto fijo, con vista previa de los primeros ítems. */
function PriceDialog({ rows, locale, onClose, onApply }: { rows: Row[]; locale: string; onClose: () => void; onApply: (adjustment: PriceAdjustment) => void }) {
  const t = useT();
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [amount, setAmount] = useState('10');
  const [rounding, setRounding] = useState<PriceRounding>('none');

  const magnitude = Number(amount.replace(',', '.'));
  const adjustment: PriceAdjustment = { mode, value: (direction === 'up' ? 1 : -1) * (Number.isFinite(magnitude) ? magnitude : 0), rounding };
  const valid = isValidAdjustment(adjustment);
  const priced = rows.filter((r) => r.price !== null);
  const preview = priced.slice(0, 5);
  const unpriced = rows.length - priced.length;
  // Con el costo guardado: cuántos quedarían por debajo de lo que te cuestan.
  const belowCost = valid ? priced.filter((r) => r.cost !== null && (adjustPrice(r.price, adjustment) ?? Infinity) < r.cost).length : 0;
  const money = (row: Row, value: number) => formatPrice(value, row.currency, locale);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('Ajustar precios')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup exclusive size="small" value={direction} onChange={(_, v) => v && setDirection(v)} aria-label={t('Sentido del ajuste')}>
              <ToggleButton value="up">{t('Aumentar')}</ToggleButton>
              <ToggleButton value="down">{t('Disminuir')}</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} aria-label={t('Tipo de ajuste')}>
              <ToggleButton value="percent">%</ToggleButton>
              <ToggleButton value="amount">{t('Monto')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <TextField
            label={mode === 'percent' ? t('Porcentaje') : t('Monto')}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            error={!valid}
            helperText={!valid ? (mode === 'percent' ? t('Entre {min} % y {max} %, distinto de cero.', { min: MIN_PERCENT, max: MAX_PERCENT }) : t('Escribe un monto distinto de cero.')) : ' '}
            slotProps={{ input: { endAdornment: mode === 'percent' ? <InputAdornment position="end">%</InputAdornment> : undefined } }}
          />
          <TextField select label={t('Redondeo')} value={rounding} onChange={(event) => setRounding(event.target.value as PriceRounding)} slotProps={{ select: { native: true } }}>
            {ROUNDINGS.map((r) => (
              <option key={r.id} value={r.id}>{t(r.label)}</option>
            ))}
          </TextField>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>{t('Vista previa')}</Typography>
            {preview.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('Ninguno de los ítems seleccionados tiene precio.')}</Typography>
            ) : (
              <Stack spacing={0.5}>
                {preview.map((row) => {
                  const next = valid ? adjustPrice(row.price, adjustment) : null;
                  return (
                    <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: 'center', fontSize: 14 }}>
                      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{row.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(row, row.price!)}</Typography>
                      <ArrowRight size={14} aria-label={t('pasa a')} />
                      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{next === null ? '—' : money(row, next)}</Typography>
                    </Stack>
                  );
                })}
                {priced.length > preview.length && (
                  <Typography variant="caption" color="text.secondary">{t('y {count} más', { count: priced.length - preview.length })}</Typography>
                )}
              </Stack>
            )}
            {belowCost > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {belowCost === 1 ? t('1 quedaría por debajo de su costo.') : t('{count} quedarían por debajo de su costo.', { count: belowCost })}
              </Alert>
            )}
            {unpriced > 0 && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                {unpriced === 1 ? t('1 ítem sin precio no cambia.') : t('{count} ítems sin precio no cambian.', { count: unpriced })}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Cancelar')}</Button>
        <Button variant="contained" disabled={!valid || priced.length === 0} onClick={() => onApply(adjustment)}>
          {priced.length === 1 ? t('Ajustar 1 precio') : t('Ajustar {count} precios', { count: priced.length })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
