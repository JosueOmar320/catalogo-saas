'use client';

import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { ImagePlus, Images, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDashboard } from '@/components/dashboard/DashboardContext';
import { useToast } from '@/components/feedback/ToastProvider';
import { UploadError, uploadImage } from '@/features/media/client';
import { MediaLibraryDialog } from '@/features/media/components/MediaLibraryDialog';
import { useT } from '@/i18n/client';
import type { MediaKind } from '@/lib/utils/storage';

type Props = {
  label: string;
  description?: string;
  kind: Exclude<MediaKind, 'items'>;
  /** URL pública de la imagen actual. */
  value: string | null;
  /** Recibe la nueva ruta en Storage (o null al quitar). Debe persistir el cambio. */
  onChange: (path: string | null) => Promise<void> | void;
  aspectRatio?: string;
  width?: number | string;
};

/** Campo de imagen única (logo, portada, favicon, categoría, imágenes del sitio): subir o elegir de la biblioteca. */
export function ImageField({ label, description, kind, value, onChange, aspectRatio = '1 / 1', width = 112 }: Props) {
  const t = useT();
  const { businessId } = useDashboard();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  const preview = localPreview ?? value;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    try {
      const uploaded = await uploadImage(file, businessId, kind);
      await onChange(uploaded.path);
    } catch (error) {
      toast.error(error instanceof UploadError ? t(error.message) : t('No se pudo subir la imagen.'));
    } finally {
      setLocalPreview(null);
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onChange(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Box
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFile(e.dataTransfer.files[0]);
        }}
        sx={{
          position: 'relative',
          width,
          aspectRatio,
          flexShrink: 0,
          borderRadius: 1.5,
          border: 1,
          borderStyle: preview ? 'solid' : 'dashed',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          backgroundImage: preview ? `url("${preview}")` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          cursor: busy ? 'progress' : 'pointer',
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        {!preview && <ImagePlus size={22} />}
        {busy && (
          <Box sx={(theme) => ({ position: 'absolute', inset: 0, bgcolor: `rgba(${theme.vars.palette.background.paperChannel} / 0.7)`, display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
            <CircularProgress size={20} />
          </Box>
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        {description && <Typography variant="caption" color="text.secondary" component="p">{description}</Typography>}
        <Stack direction="row" sx={{ mt: 1, gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" color="inherit" startIcon={<Upload size={14} />} onClick={() => inputRef.current?.click()} disabled={busy}>
            {value ? t('Reemplazar') : t('Subir')}
          </Button>
          <Button color="inherit" startIcon={<Images size={14} />} onClick={() => setLibrary(true)} disabled={busy}>
            {t('Biblioteca')}
          </Button>
          {value && (
            <Button color="error" startIcon={<Trash2 size={14} />} onClick={remove} disabled={busy}>
              {t('Quitar')}
            </Button>
          )}
        </Stack>
      </Box>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
      <MediaLibraryDialog
        open={library}
        onClose={() => setLibrary(false)}
        // Logo, portada, favicon, imagen para compartir y categorías se guardan en columnas que exigen un archivo propio.
        storageOnly={kind !== 'site'}
        initialFolder={kind === 'logo' || kind === 'favicon' ? 'logos' : kind === 'category' ? 'products' : 'all'}
        onSelect={async (image) => {
          setBusy(true);
          try {
            await onChange(image.path);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Stack>
  );
}
