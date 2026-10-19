'use client';

import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export function CopyField({ value, label, openable = true }: { value: string; label?: string; openable?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <TextField
      label={label}
      value={value}
      slotProps={{
        htmlInput: { readOnly: true, style: { fontSize: 13 } },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={copied ? 'Copiado' : 'Copiar enlace'}>
                <IconButton
                  onClick={async () => {
                    // Puede fallar sin permiso de portapapeles: el enlace sigue visible para copiarlo a mano.
                    const done = await navigator.clipboard.writeText(value).then(() => true, () => false);
                    if (!done) return;
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  aria-label="Copiar enlace"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </IconButton>
              </Tooltip>
              {openable && (
                <Tooltip title="Abrir">
                  <IconButton href={value} target="_blank" aria-label="Abrir en otra pestaña">
                    <ExternalLink size={15} />
                  </IconButton>
                </Tooltip>
              )}
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
