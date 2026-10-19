'use client';

import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import type { ColorMode } from '@/components/providers/color-mode';

const OPTIONS: { mode: ColorMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Claro', icon: Sun },
  { mode: 'dark', label: 'Oscuro', icon: Moon },
  { mode: 'system', label: 'Sistema', icon: Monitor },
];

/**
 * Selector de modo claro / oscuro / sistema (MUI guarda la elección en
 * localStorage). En el servidor el modo es desconocido: hasta montar se
 * muestra el ícono de "sistema" para no desajustar la hidratación.
 */
export function ColorModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const resolved = mode === 'system' ? systemMode : mode;
  const Icon = !mode ? Monitor : resolved === 'dark' ? Moon : Sun;

  return (
    <>
      <Tooltip title="Apariencia">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Cambiar apariencia" aria-haspopup="menu" aria-expanded={Boolean(anchor)}>
          <Icon size={17} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.mode}
            selected={mode === option.mode}
            onClick={() => {
              setMode(option.mode);
              setAnchor(null);
            }}
          >
            <ListItemIcon><option.icon size={16} /></ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
            {mode === option.mode && <Check size={15} style={{ marginLeft: 12 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
