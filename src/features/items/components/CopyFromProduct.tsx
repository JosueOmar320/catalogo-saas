'use client';

import { Button, ListItemText, Menu, MenuItem } from '@mui/material';
import { Copy } from 'lucide-react';
import { useId, useState } from 'react';
import { useT } from '@/i18n/client';
import type { CatalogItemView } from '@/lib/catalog/view-model';

/**
 * "Copiar de…": lista los productos que ya tienen opciones o extras para
 * traerlos a este (sin retocarlos uno por uno en cada bebida).
 */
export function CopyFromProduct({ sources, detail, onPick, label }: { sources: CatalogItemView[]; detail: (item: CatalogItemView) => string; onPick: (item: CatalogItemView) => void; label: string }) {
  const t = useT();
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (sources.length === 0) return null;
  return (
    <>
      <Button size="small" color="inherit" startIcon={<Copy size={14} />} aria-haspopup="menu" aria-controls={anchor ? id : undefined} onClick={(event) => setAnchor(event.currentTarget)}>
        {t('Copiar de…')}
      </Button>
      <Menu id={id} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ list: { 'aria-label': label } }}>
        {sources.map((item) => (
          <MenuItem
            key={item.id}
            onClick={() => {
              setAnchor(null);
              onPick(item);
            }}
          >
            <ListItemText primary={item.name} secondary={detail(item)} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
