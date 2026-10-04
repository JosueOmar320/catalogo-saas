'use client';

import { Box, Chip, InputAdornment, TextField } from '@mui/material';
import { Search } from 'lucide-react';

const DATE = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });
const DATETIME = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDay = (value: string | null | undefined) => (value ? DATE.format(new Date(value)) : '—');
export const formatMoment = (value: string | null | undefined) => (value ? DATETIME.format(new Date(value)) : 'Nunca');

export function StatusChip({ status }: { status: 'active' | 'disabled' | 'suspended' | 'inactive' | 'published' | 'draft' | 'unpublished' }) {
  const map = {
    active: { label: 'Activo', color: 'success' },
    disabled: { label: 'Desactivado', color: 'default' },
    suspended: { label: 'Suspendido', color: 'warning' },
    inactive: { label: 'Inactivo', color: 'default' },
    published: { label: 'Publicado', color: 'success' },
    draft: { label: 'Borrador', color: 'default' },
    unpublished: { label: 'Despublicado', color: 'default' },
  } as const;
  const { label, color } = map[status];
  return <Chip size="small" label={label} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ fontWeight: 600 }} />;
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
