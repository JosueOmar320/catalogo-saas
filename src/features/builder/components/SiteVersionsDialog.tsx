'use client';

import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useLocale, useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import type { SiteVersionSummary } from '@/lib/site/versions';
import { useBuilder } from '../state';
import { deleteSiteVersion, listSiteVersions, nameSiteVersion, openSiteVersion, renameSiteVersion } from '../version-actions';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Al abrir una versión: su nombre (o fecha) y cuántas imágenes se quitaron por ya no existir. */
  onRestored: (name: string, missingImages: number) => void;
};

/**
 * Historial del sitio: cada guardado deja una versión. Abrir una la carga en
 * el editor como borrador (se aplica al guardar y se puede deshacer).
 */
export function SiteVersionsDialog({ open, onClose, onRestored }: Props) {
  const t = useT();
  const locale = useLocale();
  const confirm = useConfirm();
  const { state, dispatch } = useBuilder();
  const { run, pending } = useAction();
  const [versions, setVersions] = useState<SiteVersionSummary[] | null>(null);
  const [label, setLabel] = useState('');
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const dirty = state.dirty.theme || state.dirty.navigation || state.dirty.pages;

  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const nameOf = (version: SiteVersionSummary) => version.label ?? when(version.createdAt);

  const load = () => void run(() => listSiteVersions(), { successToast: false, onSuccess: setVersions });
  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al abrir
  }, [open]);

  const restore = async (version: SiteVersionSummary) => {
    if (dirty) {
      const yes = await confirm({
        title: t('¿Abrir esta versión?'),
        description: t('Tus cambios sin guardar se reemplazan en el editor. Puedes recuperarlos con Deshacer.'),
        confirmLabel: t('Abrir versión'),
      });
      if (!yes) return;
    }
    void run(() => openSiteVersion(version.id), {
      successToast: false,
      onSuccess: ({ snapshot, missingImages }) => {
        dispatch({ type: 'restoreVersion', snapshot });
        onRestored(nameOf(version), missingImages);
        onClose();
      },
    });
  };

  const saveNamed = () => void run(() => nameSiteVersion(label), { onSuccess: () => { setLabel(''); load(); } });

  const rename = () => {
    if (!editing) return;
    const { id, label: next } = editing;
    void run(() => renameSiteVersion(id, next), {
      onSuccess: () => {
        setVersions((list) => list?.map((v) => (v.id === id ? { ...v, label: next.trim() } : v)) ?? null);
        setEditing(null);
      },
    });
  };

  const remove = async (version: SiteVersionSummary) => {
    const yes = await confirm({ title: t('¿Borrar la versión «{name}»?', { name: nameOf(version) }), description: t('Se quita del historial. Tu sitio no cambia.'), confirmLabel: t('Borrar'), destructive: true });
    if (yes) void run(() => deleteSiteVersion(version.id), { onSuccess: () => setVersions((list) => list?.filter((v) => v.id !== version.id) ?? null) });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('Historial del sitio')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('Cada vez que guardas se crea una versión con el diseño, la navegación y las páginas (no los productos ni los ajustes). Abre una para revisarla: sólo se aplica si guardas.')}
        </Typography>

        <Stack direction="row" spacing={1} component="form" onSubmit={(event) => { event.preventDefault(); saveNamed(); }} sx={{ mb: dirty ? 1 : 2 }}>
          <TextField size="small" fullWidth label={t('Nombre de la versión')} placeholder={t('Ej. Antes del rediseño')} value={label} onChange={(e) => setLabel(e.target.value.slice(0, 80))} disabled={dirty} />
          <Button type="submit" variant="outlined" disabled={dirty || pending || !label.trim()} sx={{ flexShrink: 0 }}>
            {t('Guardar versión')}
          </Button>
        </Stack>
        {dirty && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
            {t('Guarda tus cambios primero: la versión copia el sitio guardado.')}
          </Typography>
        )}

        {versions === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} aria-label={t('Cargando…')} />
          </Box>
        ) : versions.length === 0 ? (
          <Alert severity="info">{t('Todavía no hay versiones. Se crean al guardar el sitio.')}</Alert>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('Versiones')}>
            {versions.map((version, index) => (
              <Box component="li" key={version.id} aria-label={nameOf(version)} sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                {editing?.id === version.id ? (
                  <Stack direction="row" spacing={0.5} component="form" onSubmit={(event) => { event.preventDefault(); rename(); }} sx={{ alignItems: 'center' }}>
                    <TextField size="small" fullWidth autoFocus label={t('Nombre de la versión')} value={editing.label} onChange={(e) => setEditing({ id: version.id, label: e.target.value.slice(0, 80) })} />
                    <IconButton type="submit" disabled={pending || !editing.label.trim()} aria-label={t('Guardar nombre')}><Check size={16} /></IconButton>
                    <IconButton onClick={() => setEditing(null)} aria-label={t('Cancelar')}><X size={16} /></IconButton>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{nameOf(version)}</Typography>
                        {index === 0 && <Chip size="small" label={t('Última guardada')} />}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {[version.label && when(version.createdAt), version.author, version.pageCount === 1 ? t('1 página') : t('{count} páginas', { count: version.pageCount })].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" disabled={pending} onClick={() => void restore(version)} aria-label={t('Abrir la versión {name}', { name: nameOf(version) })}>
                      {t('Abrir')}
                    </Button>
                    <Tooltip title={t('Cambiar nombre')}>
                      <IconButton size="small" disabled={pending} onClick={() => setEditing({ id: version.id, label: version.label ?? '' })} aria-label={t('Cambiar nombre')}><Pencil size={15} /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('Borrar')}>
                      <IconButton size="small" disabled={pending} onClick={() => void remove(version)} aria-label={t('Borrar la versión {name}', { name: nameOf(version) })}><Trash2 size={15} /></IconButton>
                    </Tooltip>
                  </Stack>
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>{t('Cerrar')}</Button>
      </DialogActions>
    </Dialog>
  );
}
