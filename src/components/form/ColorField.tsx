'use client';

import { Box, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

type Props = {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Selector de color: muestra + input nativo + hex editable. */
export function ColorField({ label, description, value, onChange }: Props) {
  const [text, setText] = useState(value);
  // Sincroniza el texto cuando el valor cambia desde afuera (p. ej. al aplicar un tema).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        {description && <Typography variant="caption" color="text.secondary">{description}</Typography>}
      </Box>
      <TextField
        value={text}
        onChange={(e) => {
          const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
          setText(next);
          if (HEX.test(next)) onChange(next.toUpperCase());
        }}
        onBlur={() => setText(value)}
        error={!HEX.test(text)}
        sx={{ width: 138, flexShrink: 0 }}
        slotProps={{
          htmlInput: { maxLength: 7, 'aria-label': `${label} (hex)`, style: { fontFamily: 'ui-monospace, monospace', fontSize: 13 } },
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0.5 }}>
                <Box
                  component="label"
                  sx={{ position: 'relative', width: 22, height: 22, borderRadius: 1, bgcolor: value, border: 1, borderColor: 'divider', cursor: 'pointer', overflow: 'hidden' }}
                >
                  <Box
                    component="input"
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value.toUpperCase())}
                    aria-label={label}
                    sx={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 0, p: 0 }}
                  />
                </Box>
              </InputAdornment>
            ),
          },
        }}
      />
    </Stack>
  );
}
