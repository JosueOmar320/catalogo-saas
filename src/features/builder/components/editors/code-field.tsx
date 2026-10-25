'use client';

import { Alert, TextField } from '@mui/material';
import { useT } from '@/i18n/client';

/** Campo de código: monoespaciado, sin corrector ni autocompletar. */
export function CodeField({ label, value, onChange, maxLength, rows = 14, maxRows = 30, placeholder, helper }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; rows?: number; maxRows?: number; placeholder?: string; helper?: string }) {
  const t = useT();
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
      multiline
      minRows={rows}
      maxRows={maxRows}
      placeholder={placeholder}
      helperText={helper ?? t('{count} de {max} caracteres', { count: value.length.toLocaleString(), max: maxLength.toLocaleString() })}
      slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: 'off', autoCorrect: 'off', style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.5 } }, inputLabel: { shrink: true } }}
    />
  );
}

/** Aviso cuando el administrador no habilitó el código propio. */
export function CustomCodeDisabled() {
  const t = useT();
  return <Alert severity="warning">{t('El código propio no está habilitado para tu negocio: lo que escribas aquí no se publica. Pídele al administrador de la plataforma que lo active.')}</Alert>;
}
