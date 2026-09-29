'use client';

import { Box, ButtonBase, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listMediaLibrary, type LibraryImage } from '../actions';

/** Biblioteca de medios del negocio: elegir una imagen ya subida o importada. */
export function MediaLibraryDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (image: LibraryImage) => void }) {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<LibraryImage[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await listMediaLibrary(query);
      if (!cancelled) setImages(result.ok ? result.data : []);
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>Biblioteca de imágenes</Box>
        <IconButton onClick={onClose} aria-label="Cerrar"><X size={18} /></IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar por descripción"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 2 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment> } }}
        />
        {images === null ? (
          <Stack sx={{ py: 6, alignItems: 'center' }}><CircularProgress size={24} /></Stack>
        ) : images.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            {query ? 'No hay imágenes con esa descripción.' : 'Aún no hay imágenes. Súbelas desde cualquier campo de imagen o pídele a Garfield que busque una.'}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.25, pb: 1 }}>
            {images.map((image) => (
              <ButtonBase
                key={image.id}
                onClick={() => {
                  onSelect(image);
                  onClose();
                }}
                sx={{ display: 'block', borderRadius: 1.5, overflow: 'hidden', border: 1, borderColor: 'divider', textAlign: 'left', '&:hover': { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` } }}
              >
                <Box component="img" src={image.thumbUrl} alt={image.alt} loading="lazy" sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', bgcolor: 'action.hover' }} />
                <Typography variant="caption" noWrap component="p" sx={{ px: 1, py: 0.5 }}>{image.alt || 'Sin descripción'}</Typography>
              </ButtonBase>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
