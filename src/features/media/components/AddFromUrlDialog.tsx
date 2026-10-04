'use client';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { MediaFolder } from '@/types/database';
import { MEDIA_FOLDER_LABELS, MEDIA_FOLDERS, type AddFromUrlInput } from '../schema';

/**
 * Agregar una imagen por URL. "Importar" (recomendado) la copia a la
 * biblioteca; "Usar enlace" guarda sólo la referencia. En ambos casos el
 * servidor verifica que sea una imagen pública (sin acceso a redes internas).
 */
export function AddFromUrlDialog({ open, onClose, onAdd, defaultFolder, allowExternal = true }: { open: boolean; onClose: () => void; onAdd: (input: AddFromUrlInput) => Promise<boolean>; defaultFolder: MediaFolder; allowExternal?: boolean }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'import' | 'external'>('import');
  const [folder, setFolder] = useState<MediaFolder>(defaultFolder);
  const [busy, setBusy] = useState(false);
  const valid = /^https:\/\/\S+$/.test(url.trim());

  const close = () => {
    if (busy) return;
    setUrl('');
    setName('');
    setMode('import');
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Agregar imagen desde una URL</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField autoFocus label="URL de la imagen" placeholder="https://ejemplo.com/foto.jpg" value={url} onChange={(e) => setUrl(e.target.value)} error={url.length > 0 && !valid} helperText={url.length > 0 && !valid ? 'Usa una dirección que empiece con https://' : 'Copia la dirección de la imagen (clic derecho → "Copiar dirección de imagen").'} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} sx={{ flex: 1 }} />
            <TextField select label="Carpeta" value={folder} onChange={(e) => setFolder(e.target.value as MediaFolder)} sx={{ minWidth: 160 }}>
              {MEDIA_FOLDERS.map((f) => <MenuItem key={f} value={f}>{MEDIA_FOLDER_LABELS[f]}</MenuItem>)}
            </TextField>
          </Stack>
          {allowExternal && (
            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as 'import' | 'external')}>
              <FormControlLabel value="import" control={<Radio size="small" />} label={<Typography variant="body2"><b>Importar a mi biblioteca</b> (recomendado): se guarda una copia optimizada. Siempre disponible y rápida.</Typography>} sx={{ alignItems: 'flex-start', '& .MuiRadio-root': { pt: 0.25 } }} />
              <FormControlLabel value="external" control={<Radio size="small" />} label={<Typography variant="body2"><b>Usar el enlace</b>: no se copia. Si el otro sitio la cambia o la borra, desaparece de tu página.</Typography>} sx={{ alignItems: 'flex-start', mt: 1, '& .MuiRadio-root': { pt: 0.25 } }} />
            </RadioGroup>
          )}
          {mode === 'external' && <Alert severity="warning">Los enlaces externos sirven para secciones, fondos, galerías y el PDF. Para logo, productos y categorías hay que importarla.</Alert>}
          <Typography variant="caption" color="text.secondary">Usa sólo imágenes que tengas derecho a usar.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={close} disabled={busy}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onAdd({ url: url.trim(), mode, name, folder });
            setBusy(false);
            if (ok) close();
          }}
        >
          {busy ? 'Verificando…' : mode === 'import' ? 'Importar' : 'Agregar enlace'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
