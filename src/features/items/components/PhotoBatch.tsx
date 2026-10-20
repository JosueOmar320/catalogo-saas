'use client';

import { Alert, Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, Stack, Switch, TextField, Typography } from '@mui/material';
import { Images, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UploadError, uploadImage, validateImageFile } from '@/features/media/client';
import { useT } from '@/i18n/client';
import { MAX_PHOTO_BATCH, nameFromFile } from '@/lib/catalog/photo-names';
import { useAction } from '@/lib/hooks/use-action';
import { createItemsFromPhotos } from '../actions';

type Entry = { key: string; file: File; preview: string; name: string };
type Props = { businessId: string; type: 'product' | 'service'; categories: { id: string; name: string }[] };

/**
 * "Crear desde fotos": elige o arrastra varias fotos y cada una se vuelve un
 * producto (o servicio) con su nombre sugerido. Se suben de 3 en 3 y luego se
 * crean de una vez; quedan ocultos salvo que se pida mostrarlos.
 */
export function PhotoBatchButton(props: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" color="inherit" startIcon={<Images size={15} />} onClick={() => setOpen(true)}>
        {t('Crear desde fotos')}
      </Button>
      {open && <PhotoBatchDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function PhotoBatchDialog({ businessId, type, categories, onClose }: Props & { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const { run } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const busy = progress !== null;
  const missingNames = entries.some((entry) => !entry.name.trim());

  // Las vistas previas son URLs del navegador: se liberan al cerrar.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const addFiles = (files: File[]) => {
    const room = MAX_PHOTO_BATCH - entries.length;
    const valid = files.filter((file) => !validateImageFile(file));
    const accepted = valid.slice(0, Math.max(0, room));
    setNotice(
      valid.length < files.length
        ? t('Algunos archivos no son imágenes JPG, PNG o WebP de hasta 15 MB y se omitieron.')
        : accepted.length < valid.length
          ? t('Hasta {max} fotos a la vez.', { max: MAX_PHOTO_BATCH })
          : null,
    );
    const next = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, preview, name: nameFromFile(file.name) };
    });
    setEntries((list) => [...list, ...next]);
    if (input.current) input.current.value = '';
  };

  const submit = async () => {
    if (!entries.length || missingNames) return;
    setProgress({ done: 0, total: entries.length });
    const uploaded: { index: number; name: string; image: Awaited<ReturnType<typeof uploadImage>> }[] = [];
    let failed = 0;
    let reason: string | null = null;
    const queue = entries.map((entry, index) => ({ entry, index }));
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { entry, index } = next;
        try {
          uploaded.push({ index, name: entry.name.trim(), image: await uploadImage(entry.file, businessId, 'items') });
        } catch (error) {
          failed++;
          if (error instanceof UploadError) reason ??= t(error.message);
          else console.error('[photo-batch]', error);
        }
        setProgress((p) => p && { ...p, done: p.done + 1 });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (!uploaded.length) {
      setProgress(null);
      setNotice(reason ?? t('No se pudo subir ninguna foto. Intenta de nuevo.'));
      return;
    }
    // Mismo orden en que se eligieron.
    uploaded.sort((a, b) => a.index - b.index);
    const result = await run(() =>
      createItemsFromPhotos({
        type,
        categoryId: categoryId || null,
        visible,
        items: uploaded.map(({ name, image }) => ({ name, image: { path: image.path, thumbPath: image.thumbPath, width: image.width, height: image.height, sizeBytes: image.sizeBytes, mimeType: image.mimeType, alt: name } })),
      }),
    );
    setProgress(null);
    if (!result?.ok) return;
    if (failed) setNotice(t('{count} fotos no se pudieron subir.', { count: failed }));
    router.refresh();
    if (!failed) onClose();
    else setEntries([]);
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth aria-labelledby="photo-batch-title">
      <DialogTitle id="photo-batch-title">{type === 'service' ? t('Crear servicios desde fotos') : t('Crear productos desde fotos')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t('Cada foto se vuelve un ítem con ese nombre. Después completas precio y descripción. Hasta {max} fotos a la vez.', { max: MAX_PHOTO_BATCH })}
          </Typography>
          <Box
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(Array.from(event.dataTransfer.files));
            }}
            sx={{ border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, p: 2.5, textAlign: 'center' }}
          >
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => addFiles(Array.from(event.target.files ?? []))} aria-label={t('Elegir fotos')} />
            <Button variant="outlined" color="inherit" startIcon={<Images size={15} />} onClick={() => input.current?.click()} disabled={busy || entries.length >= MAX_PHOTO_BATCH}>
              {entries.length ? t('Agregar más fotos') : t('Elegir fotos')}
            </Button>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {t('o arrástralas aquí')}
            </Typography>
          </Box>
          {notice && <Alert severity="info">{notice}</Alert>}

          {entries.length > 0 && (
            <Stack spacing={1} role="list" aria-label={t('Fotos elegidas')}>
              {entries.map((entry, index) => (
                <Stack key={entry.key} role="listitem" direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Avatar variant="rounded" src={entry.preview} alt="" sx={{ width: 48, height: 48 }} />
                  <TextField
                    size="small"
                    fullWidth
                    value={entry.name}
                    disabled={busy}
                    placeholder={t('Nombre del producto')}
                    error={!entry.name.trim()}
                    onChange={(event) => setEntries((list) => list.map((e) => (e.key === entry.key ? { ...e, name: event.target.value.slice(0, 160) } : e)))}
                    slotProps={{ htmlInput: { 'aria-label': t('Nombre para la foto {index}', { index: index + 1 }) } }}
                  />
                  <IconButton size="small" disabled={busy} onClick={() => setEntries((list) => list.filter((e) => e.key !== entry.key))} aria-label={t('Quitar la foto {index}', { index: index + 1 })}>
                    <Trash2 size={15} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
          {missingNames && <Typography variant="caption" color="error">{t('Escribe el nombre de cada foto (las de la cámara no traen uno útil).')}</Typography>}

          {entries.length > 0 && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
              <TextField select size="small" label={t('Categoría')} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={busy} sx={{ minWidth: 220 }} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
                <option value="">{t('Sin categoría')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </TextField>
              <FormControlLabel control={<Switch checked={visible} onChange={(event) => setVisible(event.target.checked)} disabled={busy} />} label={t('Mostrarlos ya en el catálogo')} />
            </Stack>
          )}
          {progress && (
            <Box aria-live="polite">
              <Typography variant="body2" sx={{ mb: 1 }}>{t('Subiendo fotos… {done} de {total}', progress)}</Typography>
              <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} aria-label={t('Progreso de las fotos')} />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{t('Cancelar')}</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !entries.length || missingNames}>
          {entries.length === 1 ? t('Crear 1 ítem') : t('Crear {count} ítems', { count: entries.length })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
