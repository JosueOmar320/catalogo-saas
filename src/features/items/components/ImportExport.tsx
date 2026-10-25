'use client';

import { useFeatureEnabled } from '@/components/dashboard/DashboardContext';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Download, FileUp, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useT } from '@/i18n/client';
import { CSV_TEMPLATE_ROWS, itemsToCsv, matchKey, parseCsv, parseItemTable, type ImportIssue, type ImportRow, type ItemColumn } from '@/lib/catalog/csv';
import { useAction } from '@/lib/hooks/use-action';
import { importItemImages, importItems, type PendingImages } from '../import';

type Props = {
  /** Claves (código o nombre+tipo) de los ítems que ya existen: para saber qué se actualiza. */
  existingKeys: string[];
  /** Las mismas claves sólo por nombre+tipo: valen cuando el archivo no trae la columna de código. */
  existingNameKeys: string[];
  /** Nombres de categorías existentes (en minúsculas): para avisar cuáles se crean. */
  categoryNames: string[];
  defaultType: 'product' | 'service';
};

const MAX_BYTES = 2 * 1024 * 1024;

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Botones "Exportar" e "Importar" del listado de productos y servicios. */
export function ImportExport({ existingKeys, existingNameKeys, categoryNames, defaultType }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const canImport = useFeatureEnabled('import');
  return (
    <>
      <Button variant="outlined" color="inherit" startIcon={<Download size={15} />} href="/api/catalog/export">
        {t('Exportar')}
      </Button>
      {canImport && (
        <Button variant="outlined" color="inherit" startIcon={<Upload size={15} />} onClick={() => setOpen(true)}>
          {t('Importar')}
        </Button>
      )}
      {open && <ImportDialog existingKeys={existingKeys} existingNameKeys={existingNameKeys} categoryNames={categoryNames} defaultType={defaultType} onClose={() => setOpen(false)} />}
    </>
  );
}

type Parsed = { fileName: string; rows: ImportRow[]; issues: ImportIssue[]; columns: ItemColumn[] };
type Photos = { done: number; total: number; added: number; failed: { name: string; url: string }[]; finished: boolean };

/** Descarga las fotos de varios ítems, de 3 en 3 (cada llamada es una función corta en el servidor). Devuelve cuántas fallaron. */
async function downloadPhotos(pending: PendingImages[], onProgress: (update: (photos: Photos) => Photos) => void): Promise<number> {
  const queue = [...pending];
  let failures = 0;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const { itemId, name, urls } = item;
      const result = await importItemImages({ itemId, urls }).catch(() => null);
      const failed = result?.ok ? result.data.failed : urls;
      const added = result?.ok ? result.data.added : 0;
      failures += failed.length;
      onProgress((p) => ({ ...p, done: p.done + 1, added: p.added + added, failed: [...p.failed, ...failed.map((url) => ({ name, url }))] }));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return failures;
}

function ImportDialog({ existingKeys, existingNameKeys, categoryNames, defaultType, onClose }: Props & { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [createCategories, setCreateCategories] = useState(true);
  const [photos, setPhotos] = useState<Photos | null>(null);
  const downloading = photos !== null && !photos.finished;
  const busy = pending || downloading;
  const withPhotos = parsed?.rows.filter((r) => r.images.length > 0).length ?? 0;

  // Sin columna de código, los existentes se reconocen por nombre (igual que en el servidor).
  const bySku = parsed?.columns.includes('sku') ?? true;
  const existing = new Set(bySku ? existingKeys : existingNameKeys);
  const knownCategories = new Set(categoryNames.map((n) => n.toLowerCase()));
  const updates = parsed?.rows.filter((r) => existing.has(matchKey(r, bySku))).length ?? 0;
  const creates = (parsed?.rows.length ?? 0) - updates;
  const newCategories = parsed ? [...new Set(parsed.rows.map((r) => r.category).filter((c): c is string => Boolean(c) && !knownCategories.has(c!.toLowerCase())))] : [];

  const readFile = async (file: File) => {
    setFileError(null);
    if (file.size > MAX_BYTES) return setFileError(t('El archivo pesa más de 2 MB.'));
    const text = await file.text();
    const { rows, issues, columns } = parseItemTable(parseCsv(text), defaultType);
    setParsed({ fileName: file.name, rows, issues, columns });
  };

  const submit = async () => {
    if (!parsed?.rows.length) return;
    const result = await run(() => importItems({ rows: parsed.rows.map(({ line: _line, ...row }) => row), createCategories, columns: parsed.columns }));
    if (!result?.ok) return;
    const pendingPhotos = result.data.images;
    if (pendingPhotos.length === 0) {
      router.refresh();
      onClose();
      return;
    }
    // Las fotos se descargan después, con progreso; si alguna falla se muestra cuál.
    setPhotos({ done: 0, total: pendingPhotos.length, added: 0, failed: [], finished: false });
    const failures = await downloadPhotos(pendingPhotos, (update) => setPhotos((p) => p && update(p)));
    router.refresh();
    if (failures === 0) onClose();
    else setPhotos((p) => p && { ...p, finished: true });
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('Importar desde CSV')}</DialogTitle>
      <DialogContent dividers>
        {photos ? (
          <PhotoProgress photos={photos} />
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('Usa un archivo CSV (Excel: Archivo → Guardar como → CSV). Columnas: nombre, tipo, categoria, precio, precio_anterior, codigo, descripcion_corta, descripcion, disponible, visible, destacado, etiquetas, imagenes. Sólo "nombre" es obligatoria. Si un código (o nombre) ya existe, ese ítem se actualiza.')}{' '}
              <MuiLink component="button" type="button" onClick={() => download('plantilla-catalogo.csv', itemsToCsv(CSV_TEMPLATE_ROWS))} sx={{ verticalAlign: 'baseline' }}>
                {t('Descargar plantilla')}
              </MuiLink>
            </Typography>

            <Box
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void readFile(file);
              }}
              sx={{ border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center' }}
            >
              <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(event) => event.target.files?.[0] && void readFile(event.target.files[0])} />
              <Button variant="outlined" color="inherit" startIcon={<FileUp size={15} />} onClick={() => input.current?.click()}>
                {parsed ? t('Elegir otro archivo') : t('Elegir archivo CSV')}
              </Button>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                {parsed ? parsed.fileName : t('o arrástralo aquí')}
              </Typography>
            </Box>
            {fileError && <Alert severity="error">{fileError}</Alert>}

            {parsed && (
              <>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} aria-live="polite">
                  <Chip color="success" variant="outlined" label={creates === 1 ? t('1 nuevo') : t('{count} nuevos', { count: creates })} />
                  <Chip color="info" variant="outlined" label={updates === 1 ? t('1 se actualiza') : t('{count} se actualizan', { count: updates })} />
                  {parsed.issues.length > 0 && <Chip color="warning" variant="outlined" label={t('{count} con problemas', { count: parsed.issues.length })} />}
                </Stack>

                {parsed.issues.length > 0 && (
                  <Alert severity="warning">
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t('Estas filas no se importan:')}</Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 140, overflowY: 'auto' }}>
                      {parsed.issues.slice(0, 50).map((issue, index) => (
                        <li key={index}>
                          <Typography variant="body2">{t('Línea {line}: {message}', { line: issue.line, message: t(issue.message, issue.params) })}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Alert>
                )}

                {newCategories.length > 0 && (
                  <FormControlLabel
                    control={<Checkbox checked={createCategories} onChange={(event) => setCreateCategories(event.target.checked)} />}
                    label={t('Crear las categorías que no existen: {names}', { names: newCategories.slice(0, 6).join(', ') + (newCategories.length > 6 ? '…' : '') })}
                  />
                )}

                {parsed.rows.length > 0 && (
                  <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                    <Table size="small" sx={{ minWidth: 560 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('Nombre')}</TableCell>
                          <TableCell>{t('Categoría')}</TableCell>
                          <TableCell align="right">{t('Precio')}</TableCell>
                          <TableCell>{t('Código')}</TableCell>
                          <TableCell>{t('Acción')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {parsed.rows.slice(0, 8).map((row) => (
                          <TableRow key={row.line}>
                            <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</TableCell>
                            <TableCell>{row.category ?? '—'}</TableCell>
                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.price ?? '—'}</TableCell>
                            <TableCell>{row.sku ?? '—'}</TableCell>
                            <TableCell>{existing.has(matchKey(row, bySku)) ? t('Se actualiza') : t('Nuevo')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsed.rows.length > 8 && (
                      <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 1.5, py: 1 }}>
                        {t('y {count} más', { count: parsed.rows.length - 8 })}
                      </Typography>
                    )}
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary">
                  {withPhotos > 0
                    ? withPhotos === 1
                    ? t('Al terminar se descargan las fotos de 1 fila (sólo si ese ítem aún no tiene fotos).')
                    : t('Al terminar se descargan las fotos de {count} filas (sólo para ítems que aún no tienen fotos).', { count: withPhotos })
                    : t('Para importar fotos agrega la columna "imagenes" con enlaces públicos (varios separados por |).')}
                </Typography>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {photos?.finished ? (
          <Button variant="contained" onClick={onClose}>{t('Cerrar')}</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>{t('Cancelar')}</Button>
            <Button variant="contained" onClick={() => void submit()} disabled={busy || !parsed?.rows.length}>
              {downloading ? t('Descargando fotos…') : pending ? t('Importando…') : t('Importar {count}', { count: parsed?.rows.length ?? 0 })}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function PhotoProgress({ photos }: { photos: Photos }) {
  const t = useT();
  return (
    <Stack spacing={2} aria-live="polite">
      <Typography variant="body2">
        {photos.finished ? t('Fotos listas: {added} agregadas.', { added: photos.added }) : t('Descargando fotos… {done} de {total} productos', { done: photos.done, total: photos.total })}
      </Typography>
      <LinearProgress variant="determinate" value={(photos.done / photos.total) * 100} aria-label={t('Progreso de las fotos')} />
      {photos.failed.length > 0 && (
        <Alert severity="warning">
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t('Estas fotos no se pudieron descargar (agrégalas a mano):')}</Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 160, overflowY: 'auto' }}>
            {photos.failed.slice(0, 50).map((f, index) => (
              <li key={index}>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {f.name}: {f.url}
                </Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}
    </Stack>
  );
}
