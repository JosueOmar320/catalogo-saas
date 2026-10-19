'use client';

import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Check, Copy, Download, ExternalLink, FolderInput, Images, Link2, Loader2, MoreHorizontal, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDashboard } from '@/components/dashboard/DashboardContext';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { useLocale, useT } from '@/i18n/client';
import { msg, type Translator } from '@/i18n/translate';
import type { MediaFolder } from '@/types/database';
import { addMediaFromUrl, deleteMediaItems, generateThumbnails, importExternalMedia, mediaUsage, moveMediaItems, replaceMediaItem, searchMediaPage, updateMediaItem } from '../actions';
import { UploadError, uploadImage, validateImageFile } from '../client';
import { MEDIA_FOLDER_LABELS, MEDIA_FOLDERS, MEDIA_SOURCE_LABELS, type MediaFilters, type MediaRecord, type MediaSort } from '../schema';
import { AddFromUrlDialog } from './AddFromUrlDialog';

/**
 * Biblioteca de medios del negocio ("Drive" de imágenes). Mismo componente
 * para la página /dashboard/media (gestión) y para el selector de imágenes
 * del editor (`mode="pick"`).
 */

type Props = {
  mode?: 'manage' | 'pick';
  /** Selección múltiple en modo selector (galerías). */
  multiple?: boolean;
  /** En modo selector: sólo imágenes propias (logo, productos y categorías no aceptan URLs externas). */
  storageOnly?: boolean;
  initialFolder?: MediaFolder | 'all';
  onPick?: (items: MediaRecord[]) => void;
  canManage?: boolean;
};

const PAGE = 48;
const SORT_LABELS: Record<MediaSort, string> = { recent: msg('Más recientes'), oldest: msg('Más antiguas'), name: msg('Nombre'), size: msg('Peso') };
const SOURCE_OPTIONS = [
  { value: 'all', label: msg('Todos los orígenes') },
  { value: 'upload', label: MEDIA_SOURCE_LABELS.upload },
  { value: 'import', label: msg('Importadas de URL') },
  { value: 'external', label: msg('Enlaces externos') },
  { value: 'stock', label: MEDIA_SOURCE_LABELS.stock },
  { value: 'chat', label: MEDIA_SOURCE_LABELS.chat },
] as const;

export const formatBytes = (n: number | null, locale?: string) =>
  n === null ? '—' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024)).toLocaleString(locale)} KB` : `${(n / 1024 / 1024).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;

// Lugares fijos que devuelve media_references (SQL, en español): se marcan para el catálogo.
const USAGE_PLACES: readonly string[] = [msg('Logo del negocio'), msg('Portada del catálogo'), msg('Ícono del sitio'), msg('Diseño del sitio'), msg('SEO del sitio'), msg('PDF')];

/** Traduce una etiqueta de media_references ("Producto «Café»", "Logo del negocio"…). */
function usageLabel(label: string, t: Translator): string {
  const match = /^(Página|Categoría|Producto) «([\s\S]*)»$/.exec(label);
  if (!match) return USAGE_PLACES.includes(label) ? t(label) : label;
  const name = match[2];
  if (match[1] === 'Página') return t('Página «{name}»', { name });
  if (match[1] === 'Categoría') return t('Categoría «{name}»', { name });
  return t('Producto «{name}»', { name });
}

export function MediaLibrary({ mode = 'manage', multiple = false, storageOnly = false, initialFolder = 'all', onPick, canManage = true }: Props) {
  const t = useT();
  const { businessId } = useDashboard();
  const toast = useToast();
  const confirm = useConfirm();
  const picking = mode === 'pick';
  const fileRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<Required<Pick<MediaFilters, 'query' | 'folder' | 'source' | 'sort'>>>({ query: '', folder: initialFolder, source: 'all', sort: 'recent' });
  const [items, setItems] = useState<MediaRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<MediaRecord | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const load = useCallback(async (offset = 0) => {
    // El filtro va al servidor: así el total y "Cargar más" cuentan sólo lo que se muestra.
    const result = await searchMediaPage({ ...filters, storedOnly: storageOnly, limit: PAGE, offset }).catch(() => null);
    if (!result || !result.ok) {
      toast.error(result ? t(result.error) : t('No se pudo cargar la biblioteca. Revisa tu conexión.'));
      setItems((prev) => prev ?? []);
      return;
    }
    setTotal(result.data.total);
    setItems((prev) => (offset === 0 ? result.data.items : [...(prev ?? []), ...result.data.items]));
  }, [filters, storageOnly, toast, t]);

  useEffect(() => {
    const timer = setTimeout(() => void load(0), filters.query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.query]);

  const visible = items ?? [];
  const selectedItems = visible.filter((m) => selected.includes(m.id));
  const set = (patch: Partial<typeof filters>) => {
    setSelected([]);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const upsert = (record: MediaRecord) => {
    setItems((prev) => (prev ?? []).map((m) => (m.id === record.id ? record : m)));
    setDetail((d) => (d?.id === record.id ? record : d));
  };

  /* ---------------- Subir */
  const uploadFiles = async (files: File[]) => {
    const valid = files.filter((file) => {
      const error = validateImageFile(file);
      if (error) toast.error(`${file.name}: ${t(error)}`);
      return !error;
    });
    if (!valid.length) return;
    const folder: MediaFolder = filters.folder === 'all' ? 'images' : filters.folder;
    const keys = valid.map((f) => `${f.name}-${f.size}-${Math.random()}`);
    setUploading((u) => [...u, ...keys]);
    const results = await Promise.allSettled(
      valid.map(async (file, i) => {
        try {
          return await uploadImage(file, businessId, 'media', { folder });
        } finally {
          setUploading((u) => u.filter((k) => k !== keys[i]));
        }
      }),
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed.length) toast.error(failed[0].reason instanceof UploadError ? t(failed[0].reason.message) : t('Alguna imagen no se pudo subir.'));
    const ok = results.length - failed.length;
    if (ok) toast.success(ok === 1 ? t('Imagen subida') : t('{count} imágenes subidas', { count: ok }));
    if (fileRef.current) fileRef.current.value = '';
    await load(0);
  };

  /* ---------------- Selección */
  const toggle = (record: MediaRecord) => {
    if (picking && !multiple) {
      onPick?.([record]);
      return;
    }
    setSelected((s) => (s.includes(record.id) ? s.filter((id) => id !== record.id) : [...s, record.id]));
  };

  const removeSelected = async (ids: string[]) => {
    const ok = await confirm({ title: ids.length === 1 ? t('¿Borrar esta imagen?') : t('¿Borrar {count} imágenes?', { count: ids.length }), description: t('Las que estén en uso en el sitio, productos o PDF no se borran: te diré dónde se usan.'), confirmLabel: t('Borrar'), destructive: true });
    if (!ok) return;
    const result = await deleteMediaItems(ids);
    if (!result.ok) return toast.error(t(result.error));
    const { deleted, blocked } = result.data;
    setItems((prev) => (prev ?? []).filter((m) => !deleted.includes(m.id)));
    setTotal((n) => n - deleted.length);
    setSelected((s) => s.filter((id) => !deleted.includes(id)));
    if (detail && deleted.includes(detail.id)) setDetail(null);
    if (deleted.length) toast.success(deleted.length === 1 ? t('Imagen borrada') : t('{count} imágenes borradas', { count: deleted.length }));
    if (blocked.length) {
      const places = `${blocked[0].usedIn.slice(0, 3).map((label) => usageLabel(label, t)).join(', ')}${blocked[0].usedIn.length > 3 ? '…' : ''}`;
      toast.info(
        blocked.length === 1
          ? t('«{name}» está en uso: {places}. Quítala de ahí o reemplázala.', { name: blocked[0].name, places })
          : t('{count} imágenes están en uso: {places}. Quítala de ahí o reemplázala.', { count: blocked.length, places }),
      );
    }
  };

  const moveSelected = async (folder: MediaFolder) => {
    setMoveAnchor(null);
    const result = await moveMediaItems(selected, folder);
    if (!result.ok) return toast.error(t(result.error));
    toast.success(t('Movidas a {folder}', { folder: t(MEDIA_FOLDER_LABELS[folder]) }));
    setSelected([]);
    await load(0);
  };

  const copyUrls = async (records: MediaRecord[]) => {
    await navigator.clipboard.writeText(records.map((r) => r.url).join('\n'));
    toast.success(records.length === 1 ? t('URL copiada') : t('URLs copiadas'));
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length) void uploadFiles(files);
  };

  const empty = items !== null && visible.length === 0 && uploading.length === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: picking ? 420 : undefined }}>
      {/* ------------------------------------------------ Barra */}
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          placeholder={t('Buscar por nombre o descripción')}
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          sx={{ flex: 1, minWidth: 0 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment> } }}
        />
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          {!storageOnly && (
            <TextField select size="small" value={filters.source} onChange={(e) => set({ source: e.target.value as typeof filters.source })} sx={{ minWidth: 170 }} aria-label={t('Origen')}>
              {SOURCE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{t(o.label)}</MenuItem>)}
            </TextField>
          )}
          <TextField select size="small" value={filters.sort} onChange={(e) => set({ sort: e.target.value as MediaSort })} sx={{ minWidth: 150 }} aria-label={t('Orden')}>
            {(Object.keys(SORT_LABELS) as MediaSort[]).map((s) => <MenuItem key={s} value={s}>{t(SORT_LABELS[s])}</MenuItem>)}
          </TextField>
          <Button variant="contained" startIcon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>{t('Subir')}</Button>
          <Button variant="outlined" color="inherit" startIcon={<Link2 size={15} />} onClick={() => setUrlOpen(true)}>{t('Desde URL')}</Button>
          {!picking && (
            <IconButton aria-label={t('Más opciones')} onClick={(e) => setMoreAnchor(e.currentTarget)}><MoreHorizontal size={18} /></IconButton>
          )}
        </Stack>
      </Stack>

      {/* ------------------------------------------------ Carpetas */}
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }} role="tablist" aria-label={t('Carpetas')}>
        {(['all', ...MEDIA_FOLDERS] as const).map((folder) => (
          <Chip
            key={folder}
            role="tab"
            aria-selected={filters.folder === folder}
            label={folder === 'all' ? t('Todas') : t(MEDIA_FOLDER_LABELS[folder])}
            color={filters.folder === folder ? 'primary' : 'default'}
            variant={filters.folder === folder ? 'filled' : 'outlined'}
            onClick={() => set({ folder })}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {items === null ? '' : total === 1 ? t('{count} imagen', { count: total }) : t('{count} imágenes', { count: total })}
        </Typography>
      </Stack>

      {/* ------------------------------------------------ Selección */}
      {selected.length > 0 && (
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', p: 1, pl: 1.5, borderRadius: 1.5, bgcolor: 'action.selected', flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>{selected.length === 1 ? t('{count} seleccionada', { count: selected.length }) : t('{count} seleccionadas', { count: selected.length })}</Typography>
          {picking ? (
            <Button variant="contained" size="small" startIcon={<Check size={14} />} onClick={() => onPick?.(selectedItems)}>{selected.length === 1 ? t('Usar imagen') : t('Usar {count} imágenes', { count: selected.length })}</Button>
          ) : (
            <>
              <Button size="small" color="inherit" startIcon={<FolderInput size={14} />} onClick={(e) => setMoveAnchor(e.currentTarget)}>{t('Mover a…')}</Button>
              <Button size="small" color="inherit" startIcon={<Copy size={14} />} onClick={() => copyUrls(selectedItems)}>{t('Copiar URLs')}</Button>
              {canManage && <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => removeSelected(selected)}>{t('Borrar')}</Button>}
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" color="inherit" onClick={() => setSelected(visible.map((m) => m.id))}>{t('Seleccionar todo')}</Button>
          <IconButton size="small" aria-label={t('Quitar selección')} onClick={() => setSelected([])}><X size={16} /></IconButton>
        </Stack>
      )}

      {/* ------------------------------------------------ Grilla */}
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
        sx={{ position: 'relative', flex: 1, minHeight: 240, borderRadius: 2, outline: dragging ? '2px dashed' : 'none', outlineColor: 'primary.main', outlineOffset: 4 }}
      >
        {dragging && (
          <Stack sx={(theme) => ({ position: 'absolute', inset: 0, zIndex: 2, alignItems: 'center', justifyContent: 'center', bgcolor: `rgba(${theme.vars.palette.background.paperChannel} / 0.85)`, borderRadius: 2, pointerEvents: 'none' })}>
            <Upload size={28} />
            <Typography sx={{ mt: 1, fontWeight: 600 }}>{filters.folder !== 'all' ? t('Suelta las imágenes para subirlas a {folder}', { folder: t(MEDIA_FOLDER_LABELS[filters.folder]) }) : t('Suelta las imágenes para subirlas')}</Typography>
          </Stack>
        )}
        {items === null ? (
          <Stack sx={{ py: 8, alignItems: 'center' }}><CircularProgress size={26} /></Stack>
        ) : empty ? (
          <Stack sx={{ py: 7, px: 2, alignItems: 'center', textAlign: 'center', gap: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2 }}>
            <Images size={30} />
            <Typography sx={{ fontWeight: 600 }}>{filters.query ? t('No hay imágenes con esa búsqueda') : t('Aún no hay imágenes aquí')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {t('Arrastra imágenes a este recuadro, súbelas o agrégalas desde una URL. Una imagen se sube una vez y se usa en el sitio, los productos y el PDF sin duplicarse.')}
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${picking ? 132 : 150}px, 1fr))`, gap: 1.25 }}>
            {uploading.map((key) => (
              <Stack key={key} sx={{ aspectRatio: '1 / 1', borderRadius: 1.5, border: 1, borderColor: 'divider', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                <CircularProgress size={22} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>{t('Subiendo…')}</Typography>
              </Stack>
            ))}
            {visible.map((record) => {
              const isSelected = selected.includes(record.id);
              return (
                <Box key={record.id} sx={{ position: 'relative', '&:hover .media-check, & .media-check.Mui-checked': { opacity: 1 } }}>
                  <ButtonBase
                    onClick={() => (picking || selected.length > 0 ? toggle(record) : setDetail(record))}
                    sx={{
                      display: 'block',
                      width: '100%',
                      borderRadius: 1.5,
                      overflow: 'hidden',
                      border: 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      boxShadow: isSelected ? (theme) => `0 0 0 2px ${theme.palette.primary.main}` : 'none',
                      textAlign: 'left',
                      bgcolor: 'background.paper',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Box sx={{ position: 'relative', aspectRatio: '1 / 1', bgcolor: 'action.hover', backgroundImage: 'linear-gradient(45deg,var(--checker, #f2f2f2) 25%,transparent 25%,transparent 75%,var(--checker, #f2f2f2) 75%),linear-gradient(45deg,var(--checker, #f2f2f2) 25%,transparent 25%,transparent 75%,var(--checker, #f2f2f2) 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px' }}>
                      <Box component="img" src={record.thumbUrl} alt={record.alt || record.name} loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: record.folder === 'logos' ? 'contain' : 'cover', p: record.folder === 'logos' ? 1.5 : 0 }} />
                      {record.provider === 'external' && (
                        <Chip size="small" icon={<ExternalLink size={11} />} label={t('Enlace')} sx={(theme) => ({ position: 'absolute', left: 6, bottom: 6, height: 20, fontSize: 11, bgcolor: `rgba(${theme.vars.palette.background.paperChannel} / 0.92)` })} />
                      )}
                    </Box>
                    <Box sx={{ px: 1, py: 0.75 }}>
                      <Typography variant="caption" noWrap component="p" sx={{ fontWeight: 600 }}>{record.name}</Typography>
                      <Typography variant="caption" noWrap component="p" color="text.secondary">
                        {record.width && record.height ? `${record.width}×${record.height}` : t(MEDIA_FOLDER_LABELS[record.folder])}
                      </Typography>
                    </Box>
                  </ButtonBase>
                  {(!picking || multiple) && (
                    <Checkbox
                      className="media-check"
                      size="small"
                      checked={isSelected}
                      onChange={() => toggle(record)}
                      slotProps={{ input: { 'aria-label': t('Seleccionar {name}', { name: record.name }) } }}
                      sx={{ position: 'absolute', top: 4, right: 4, p: 0.25, opacity: isSelected || selected.length > 0 ? 1 : 0, bgcolor: 'background.paper', borderRadius: 1, '&:hover': { bgcolor: 'background.paper' } }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        )}
        {items !== null && items.length < total && (
          <Stack sx={{ mt: 2, alignItems: 'center' }}>
            <Button
              color="inherit"
              disabled={loadingMore}
              startIcon={loadingMore ? <Loader2 size={14} /> : undefined}
              onClick={async () => {
                setLoadingMore(true);
                await load(items.length);
                setLoadingMore(false);
              }}
            >
              {t('Cargar más ({count})', { count: total - items.length })}
            </Button>
          </Stack>
        )}
      </Box>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))} />

      <Menu anchorEl={moveAnchor} open={Boolean(moveAnchor)} onClose={() => setMoveAnchor(null)}>
        {MEDIA_FOLDERS.map((folder) => <MenuItem key={folder} onClick={() => moveSelected(folder)}>{t(MEDIA_FOLDER_LABELS[folder])}</MenuItem>)}
      </Menu>
      <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
        <MenuItem
          onClick={async () => {
            setMoreAnchor(null);
            const result = await generateThumbnails();
            if (!result.ok) return toast.error(t(result.error));
            const { done, remaining } = result.data;
            toast.success(
              done
                ? remaining
                  ? t('{done} miniaturas generadas (faltan {remaining}; repite para seguir)', { done, remaining })
                  : t('{done} miniaturas generadas', { done })
                : t('Todas las imágenes ya tienen miniatura'),
            );
            await load(0);
          }}
        >
          <ListItemText primary={t('Generar miniaturas faltantes')} secondary={t('Para imágenes subidas antes de la biblioteca')} />
        </MenuItem>
      </Menu>

      <AddFromUrlDialog
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        defaultFolder={filters.folder === 'all' ? 'images' : filters.folder}
        allowExternal={!storageOnly}
        onAdd={async (input) => {
          const result = await addMediaFromUrl(input);
          if (!result.ok) {
            toast.error(t(result.error));
            return false;
          }
          toast.success(result.message ? t(result.message) : t('Imagen agregada'));
          await load(0);
          if (picking && !multiple) onPick?.([result.data]);
          return true;
        }}
      />

      {!picking && (
        <MediaDetail
          record={detail}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onChange={upsert}
          onDelete={(id) => removeSelected([id])}
          onCopy={(r) => copyUrls([r])}
        />
      )}
    </Box>
  );
}

/* ------------------------------------------------------------ Detalle */

type DetailProps = { record: MediaRecord; canManage: boolean; onClose: () => void; onChange: (r: MediaRecord) => void; onDelete: (id: string) => void; onCopy: (r: MediaRecord) => void };

function MediaDetail({ record, ...props }: Omit<DetailProps, 'record'> & { record: MediaRecord | null }) {
  return (
    <Drawer anchor="right" open={Boolean(record)} onClose={props.onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, p: 2.5 } } }}>
      {/* key: al abrir otra imagen, el formulario arranca de cero. */}
      {record && <MediaDetailBody key={record.id} record={record} {...props} />}
    </Drawer>
  );
}

function MediaDetailBody({ record, canManage, onClose, onChange, onDelete, onCopy }: DetailProps) {
  const t = useT();
  const locale = useLocale();
  const { businessId } = useDashboard();
  const toast = useToast();
  const confirm = useConfirm();
  const replaceRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ name: record.name, alt: record.alt });
  const [usage, setUsage] = useState<{ place: string; label: string }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const recordId = record.id;

  useEffect(() => {
    let cancelled = false;
    void mediaUsage(recordId).then((r) => {
      if (!cancelled) setUsage(r.ok ? r.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const dirty = draft.name !== record.name || draft.alt !== record.alt;

  const save = async (patch: { name?: string; alt?: string; folder?: MediaFolder }) => {
    setBusy('save');
    const result = await updateMediaItem(record.id, patch);
    setBusy(null);
    if (!result.ok) return toast.error(t(result.error));
    onChange(result.data);
  };

  const replace = async (file: File | undefined) => {
    if (!file) return;
    const ok = await confirm({ title: t('¿Reemplazar la imagen?'), description: usage?.length ? t('Se cambiará en: {places}.', { places: usage.map((u) => usageLabel(u.label, t)).join(', ') }) : t('La imagen nueva conserva el nombre y la carpeta.'), confirmLabel: t('Reemplazar') });
    if (!ok) return;
    setBusy('replace');
    try {
      const uploaded = await uploadImage(file, businessId, 'media', { register: false });
      const result = await replaceMediaItem(record.id, { ...uploaded, originalName: file.name });
      if (!result.ok) return toast.error(t(result.error));
      toast.success(result.message ? t(result.message) : t('Imagen reemplazada'));
      onChange(result.data);
    } catch (error) {
      toast.error(error instanceof UploadError ? t(error.message) : t('No se pudo subir la imagen.'));
    } finally {
      setBusy(null);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const importCopy = async () => {
    setBusy('import');
    const result = await importExternalMedia(record.id);
    setBusy(null);
    if (!result.ok) return toast.error(t(result.error));
    toast.success(result.message ? t(result.message) : t('Importada'));
    onChange(result.data);
  };

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" sx={{ flex: 1, fontSize: 17 }} noWrap>{record.name}</Typography>
        <IconButton onClick={onClose} aria-label={t('Cerrar')}><X size={18} /></IconButton>
      </Stack>
      <Box component="img" src={record.url} alt={record.alt || record.name} sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 1.5, bgcolor: 'action.hover', mb: 2 }} />

      <Stack spacing={1.5}>
        <TextField size="small" label={t('Nombre')} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <TextField size="small" label={t('Descripción (texto alternativo)')} helperText={t('Ayuda a Google, a lectores de pantalla y a que Garfield la encuentre.')} value={draft.alt} onChange={(e) => setDraft((d) => ({ ...d, alt: e.target.value }))} multiline maxRows={3} />
        {dirty && <Button variant="contained" size="small" onClick={() => save(draft)} disabled={busy === 'save' || !draft.name.trim()}>{t('Guardar cambios')}</Button>}
        <TextField select size="small" label={t('Carpeta')} value={record.folder} onChange={(e) => save({ folder: e.target.value as MediaFolder })}>
          {MEDIA_FOLDERS.map((f) => <MenuItem key={f} value={f}>{t(MEDIA_FOLDER_LABELS[f])}</MenuItem>)}
        </TextField>
      </Stack>

      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', my: 2 }}>
        <Button size="small" variant="outlined" color="inherit" startIcon={<Copy size={14} />} onClick={() => onCopy(record)}>{t('Copiar URL')}</Button>
        <Button size="small" variant="outlined" color="inherit" startIcon={<ExternalLink size={14} />} href={record.url} target="_blank" rel="noopener noreferrer">{t('Abrir')}</Button>
        {canManage && record.provider === 'external' && (
          <Tooltip title={t('Copia la imagen a tu biblioteca: deja de depender del otro sitio y se puede usar en productos y logo.')}>
            <span><Button size="small" variant="outlined" startIcon={busy === 'import' ? <CircularProgress size={12} /> : <Download size={14} />} onClick={importCopy} disabled={Boolean(busy)}>{t('Importar copia')}</Button></span>
          </Tooltip>
        )}
        {canManage && (
          <Button size="small" variant="outlined" color="inherit" startIcon={busy === 'replace' ? <CircularProgress size={12} /> : <RefreshCw size={14} />} onClick={() => replaceRef.current?.click()} disabled={Boolean(busy)}>{t('Reemplazar')}</Button>
        )}
        {canManage && <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => onDelete(record.id)}>{t('Borrar')}</Button>}
      </Stack>
      <input ref={replaceRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void replace(e.target.files?.[0])} />

      <Divider sx={{ mb: 2 }} />
      <Typography variant="overline" color="text.secondary">{t('Dónde se usa')}</Typography>
      {usage === null ? (
        <CircularProgress size={16} sx={{ display: 'block', my: 1 }} />
      ) : usage.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('En ningún lugar todavía.')}</Typography>
      ) : (
        <Stack sx={{ mb: 2, gap: 0.5 }}>
          {usage.map((u, i) => <Typography key={`${u.place}-${i}`} variant="body2">• {usageLabel(u.label, t)}</Typography>)}
        </Stack>
      )}

      <Typography variant="overline" color="text.secondary">{t('Detalles')}</Typography>
      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, m: 0, fontSize: 13, '& dt': { color: 'text.secondary' }, '& dd': { m: 0, wordBreak: 'break-word' } }}>
        <dt>{t('Medidas')}</dt><dd>{record.width && record.height ? `${record.width} × ${record.height} px` : '—'}</dd>
        <dt>{t('Peso')}</dt><dd>{formatBytes(record.sizeBytes, locale)}</dd>
        <dt>{t('Origen')}</dt><dd>{record.provider === 'external' ? t('Enlace externo') : t(MEDIA_SOURCE_LABELS[record.source])}</dd>
        {record.originalName && (<><dt>{t('Archivo')}</dt><dd>{record.originalName}</dd></>)}
        {record.sourceUrl && (<><dt>{t('Fuente')}</dt><dd><a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">{record.sourceUrl.replace(/^https?:\/\//, '').slice(0, 60)}</a></dd></>)}
        {record.attribution && (<><dt>{t('Crédito')}</dt><dd>{record.attribution}</dd></>)}
        <dt>{t('Agregada')}</dt><dd>{new Date(record.createdAt).toLocaleDateString(locale)}</dd>
      </Box>
      {record.provider === 'external' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('Es un enlace: la imagen vive en otro sitio y podría cambiar o desaparecer. Para usarla como logo o en productos, impórtala.')}
        </Alert>
      )}
    </>
  );
}
