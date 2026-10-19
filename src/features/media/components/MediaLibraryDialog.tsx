'use client';

import { Box, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { X } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { MediaFolder } from '@/types/database';
import type { MediaRecord } from '../schema';
import { MediaLibrary } from './MediaLibrary';

/**
 * Selector de imágenes: la misma biblioteca (buscar, carpetas, subir, desde
 * URL) en modo "elegir". `storageOnly` para campos que exigen una copia
 * propia (logo, productos, categorías).
 */
export function MediaLibraryDialog({
  open,
  onClose,
  onSelect,
  onSelectMany,
  multiple = false,
  storageOnly = false,
  initialFolder = 'all',
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSelect?: (image: MediaRecord) => void;
  onSelectMany?: (images: MediaRecord[]) => void;
  multiple?: boolean;
  storageOnly?: boolean;
  initialFolder?: MediaFolder | 'all';
  title?: string;
}) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { height: { md: '86vh' } } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>{title ?? (multiple ? t('Elige imágenes') : t('Elige una imagen'))}</Box>
        <IconButton onClick={onClose} aria-label={t('Cerrar')}><X size={18} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {open && (
          <MediaLibrary
            mode="pick"
            multiple={multiple}
            storageOnly={storageOnly}
            initialFolder={initialFolder}
            onPick={(items) => {
              if (multiple) onSelectMany?.(items);
              else if (items[0]) onSelect?.(items[0]);
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
