'use client';

import { Box, Chip, InputAdornment, TextField } from '@mui/material';
import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useLocale, useT } from '@/i18n/client';
import { msg } from '@/i18n/translate';

type DateValue = string | null | undefined;

/** Fechas en el idioma activo de la app. */
export function useDateFormat() {
  const t = useT();
  const locale = useLocale();
  return useMemo(() => {
    const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const moment = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    return {
      formatDay: (value: DateValue) => (value ? day.format(new Date(value)) : '—'),
      formatMoment: (value: DateValue) => (value ? moment.format(new Date(value)) : t('Nunca')),
    };
  }, [locale, t]);
}

const STATUS = {
  active: { label: msg('Activo'), color: 'success' },
  disabled: { label: msg('Desactivado'), color: 'default' },
  suspended: { label: msg('Suspendido'), color: 'warning' },
  inactive: { label: msg('Inactivo'), color: 'default' },
  published: { label: msg('Publicado'), color: 'success' },
  draft: { label: msg('Borrador'), color: 'default' },
  unpublished: { label: msg('Despublicado'), color: 'default' },
} as const;

export function StatusChip({ status }: { status: keyof typeof STATUS }) {
  const t = useT();
  const { label, color } = STATUS[status];
  return <Chip size="small" label={t(label)} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ fontWeight: 600 }} />;
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{ width: { xs: '100%', sm: 320 } }}
      slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment> } }}
    />
  );
}

export function StatCard({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}>{label}</Box>
      <Box sx={{ fontSize: 28, fontWeight: 750, letterSpacing: '-0.02em', mt: 0.5 }}>{value}</Box>
      {detail && <Box sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>{detail}</Box>}
    </Box>
  );
}

export const matches = (query: string, ...values: (string | null | undefined)[]) => {
  const q = query.trim().toLowerCase();
  return !q || values.some((v) => v?.toLowerCase().includes(q));
};
