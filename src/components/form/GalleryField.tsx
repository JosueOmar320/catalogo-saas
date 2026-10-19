'use client';

import { Box, ButtonBase, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight, ImagePlus, Images, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDashboard } from '@/components/dashboard/DashboardContext';
import { useToast } from '@/components/feedback/ToastProvider';
import { moveItem } from '@/components/ui/SortableList';
import { UploadError, uploadImage } from '@/features/media/client';
import { MediaLibraryDialog } from '@/features/media/components/MediaLibraryDialog';
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, type MediaRecord, type UploadedImage } from '@/features/media/schema';
import { publicStorageUrl } from '@/lib/utils/storage';

type Props = {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
};

const TILE = { width: 112, height: 112 } as const;

/** Imagen de la biblioteca → imagen del ítem (mismo archivo, sin copiar). */
function toUploaded(record: MediaRecord): UploadedImage {
  const mime = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(record.mimeType ?? '') ? (record.mimeType as UploadedImage['mimeType']) : null;
  // La miniatura sólo si es otro archivo (las imágenes chicas usan la misma ruta).
  return { path: record.path, thumbPath: record.thumbPath && record.thumbPath !== record.path ? record.thumbPath : null, width: record.width, height: record.height, sizeBytes: record.sizeBytes && record.sizeBytes <= MAX_UPLOAD_BYTES ? record.sizeBytes : null, mimeType: mime, alt: record.alt || record.name };
}

/**
 * Galería del ítem. Las imágenes se suben a Storage al elegirlas; la
 * asociación con el ítem se guarda junto con el formulario.
 * La primera imagen es la principal.
 */
export function GalleryField({ value, onChange }: Props) {
  const { businessId, maxImagesPerItem } = useDashboard();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [library, setLibrary] = useState(false);
  const remaining = maxImagesPerItem === null ? Infinity : maxImagesPerItem - value.length - uploading;

  const addFiles = async (files: File[]) => {
    const accepted = files.slice(0, Math.max(0, remaining));
    if (accepted.length < files.length) {
      toast.info(`Tu plan permite ${maxImagesPerItem} imágenes por ítem.`);
    }
    if (accepted.length === 0) return;
    setUploading((n) => n + accepted.length);

    // Subidas en paralelo; se agregan en el orden elegido.
    const results = await Promise.allSettled(accepted.map((file) => uploadImage(file, businessId, 'items')));
    setUploading((n) => n - accepted.length);
    const uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) toast.error(failed.reason instanceof UploadError ? failed.reason.message : 'Alguna imagen no se pudo subir.');
    if (uploaded.length) onChange([...value, ...uploaded]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Box>
      <Box
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        {value.map((image, index) => (
          <Box
            key={image.path}
            sx={{ position: 'relative', ...TILE, borderRadius: 1.5, overflow: 'hidden', border: 1, borderColor: index === 0 ? 'primary.main' : 'divider', bgcolor: 'action.hover', '&:hover .tile-actions': { opacity: 1 } }}
          >
            <Box
              component="img"
              src={publicStorageUrl(image.thumbPath ?? image.path) ?? ''}
              alt={image.alt || ''}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {index === 0 && (
              <Chip label="Principal" color="primary" sx={{ position: 'absolute', top: 6, left: 6, height: 20, fontSize: 11 }} />
            )}
            <Stack
              className="tile-actions"
              direction="row"
              sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.55)', opacity: { xs: 1, md: 0 }, transition: 'opacity .15s' }}
            >
              <Tooltip title="Mover a la izquierda">
                <span>
                  <IconButton sx={{ color: '#fff' }} disabled={index === 0} onClick={() => onChange(moveItem(value, index, index - 1))} aria-label="Mover a la izquierda">
                    <ChevronLeft size={15} />
                  </IconButton>
                </span>
              </Tooltip>
              {index !== 0 && (
                <Tooltip title="Hacer principal">
                  <IconButton sx={{ color: '#fff' }} onClick={() => onChange(moveItem(value, index, 0))} aria-label="Hacer principal">
                    <Star size={15} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Quitar">
                <IconButton sx={{ color: '#fff' }} onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label="Quitar imagen">
                  <Trash2 size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Mover a la derecha">
                <span>
                  <IconButton sx={{ color: '#fff' }} disabled={index === value.length - 1} onClick={() => onChange(moveItem(value, index, index + 1))} aria-label="Mover a la derecha">
                    <ChevronRight size={15} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>
        ))}

        {Array.from({ length: uploading }).map((_, i) => (
          <Box key={`uploading-${i}`} sx={{ ...TILE, borderRadius: 1.5, border: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ))}

        {remaining > 0 && (
          <ButtonBase
            onClick={() => inputRef.current?.click()}
            sx={{ ...TILE, borderRadius: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', flexDirection: 'column', gap: 0.5, color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
          >
            <ImagePlus size={20} />
            <Typography variant="caption">Subir</Typography>
          </ButtonBase>
        )}
        {remaining > 0 && (
          <ButtonBase
            onClick={() => setLibrary(true)}
            sx={{ ...TILE, borderRadius: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', flexDirection: 'column', gap: 0.5, color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
          >
            <Images size={20} />
            <Typography variant="caption">Biblioteca</Typography>
          </ButtonBase>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        JPG, PNG o WebP. Se optimizan automáticamente. Arrastra archivos aquí o usa el botón.
        {maxImagesPerItem !== null && ` Máximo ${maxImagesPerItem} por ítem.`}
      </Typography>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => void addFiles(Array.from(e.target.files ?? []))}
      />
      <MediaLibraryDialog
        open={library}
        onClose={() => setLibrary(false)}
        multiple
        storageOnly
        initialFolder="products"
        onSelectMany={(records) => {
          const fresh = records.filter((r) => !value.some((v) => v.path === r.path)).slice(0, Math.max(0, remaining));
          if (fresh.length < records.length && remaining !== Infinity && records.length > remaining) toast.info(`Tu plan permite ${maxImagesPerItem} imágenes por ítem.`);
          onChange([...value, ...fresh.map(toUploaded)]);
        }}
      />
    </Box>
  );
}
