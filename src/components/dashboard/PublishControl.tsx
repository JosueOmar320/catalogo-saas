'use client';

import { Box, Button, Chip, Divider, ListItemIcon, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import { ChevronDown, Eye, EyeOff, Globe, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { publishCatalog, unpublishCatalog } from '@/features/catalog/actions';
import { useT } from '@/i18n/client';
import { STATUS_LABELS } from '@/lib/catalog/status';
import { useAction } from '@/lib/hooks/use-action';
import { useDashboard } from './DashboardContext';

/**
 * Estado del catálogo + acción principal de publicar. En pantallas pequeñas se
 * pliega en un solo control («Publicar ▾» o el estado) que abre un menú con el
 * estado, la vista previa y publicar/despublicar; desde `sm` va desplegado.
 */
export function PublishControl() {
  const t = useT();
  const { catalogStatus, publicUrl, canManage, demo } = useDashboard();
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [compactAnchor, setCompactAnchor] = useState<HTMLElement | null>(null);
  const status = STATUS_LABELS[catalogStatus];
  const published = catalogStatus === 'published';
  // Publicar se bloquea en la cuenta de prueba y para quien no administra el negocio; el motivo se muestra.
  const blocked = demo ? t('En la cuenta de prueba el sitio no se publica. Usa «Vista previa» para verlo como tus clientes.') : canManage ? null : t('Sólo el dueño o un administrador puede publicar');

  const publish = () => {
    setCompactAnchor(null);
    return run(publishCatalog, { onSuccess: () => router.refresh() });
  };
  const unpublish = async () => {
    setAnchor(null);
    setCompactAnchor(null);
    const ok = await confirm({
      title: t('¿Despublicar el catálogo?'),
      description: t('Quien tenga el enlace verá una página de "catálogo no disponible" hasta que vuelvas a publicarlo. No se borra nada.'),
      confirmLabel: t('Despublicar'),
      destructive: true,
    });
    if (ok) await run(unpublishCatalog, { onSuccess: () => router.refresh() });
  };

  return (
    <>
      {/* Desde sm: estado, ver/vista previa y publicar, desplegados. */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', display: { xs: 'none', sm: 'flex' } }}>
        <Chip label={t(status.label)} color={status.color} variant={published ? 'filled' : 'outlined'} />
        {published ? (
          <>
            <Button variant="outlined" color="inherit" href={publicUrl} target="_blank" startIcon={<Globe size={14} />}>
              {t('Ver catálogo')}
            </Button>
            {canManage && (
              <>
                <Button color="inherit" onClick={(e) => setAnchor(e.currentTarget)} endIcon={<ChevronDown size={14} />} sx={{ minWidth: 0, px: 1 }} aria-label={t('Más opciones de publicación')} />
                <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                  <MenuItem onClick={unpublish} disabled={pending}>
                    <ListItemIcon><EyeOff size={16} /></ListItemIcon>
                    {t('Despublicar')}
                  </MenuItem>
                </Menu>
              </>
            )}
          </>
        ) : (
          <>
            <Button variant="outlined" color="inherit" href="/preview" target="_blank">
              {t('Vista previa')}
            </Button>
            <Tooltip title={blocked ?? ''}>
              <span>
                <Button variant="contained" startIcon={<Rocket size={14} />} onClick={publish} disabled={pending || Boolean(blocked)}>
                  {pending ? t('Publicando…') : t('Publicar')}
                </Button>
              </span>
            </Tooltip>
          </>
        )}
      </Stack>

      {/* En xs: un solo control que abre el menú de publicación. */}
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Button
          variant={published || blocked ? 'outlined' : 'contained'}
          color={published || blocked ? 'inherit' : 'primary'}
          onClick={(e) => setCompactAnchor(e.currentTarget)}
          endIcon={<ChevronDown size={14} />}
          startIcon={published ? <Globe size={14} /> : <Rocket size={14} />}
          aria-haspopup="menu"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {published ? t(status.label) : t('Publicar')}
        </Button>
        <Menu
          anchorEl={compactAnchor}
          open={Boolean(compactAnchor)}
          onClose={() => setCompactAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { minWidth: 240, maxWidth: 'calc(100vw - 24px)' } } }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, py: 1 }}>
            <Typography variant="body2" color="text.secondary">{t('Estado')}</Typography>
            <Chip size="small" label={t(status.label)} color={status.color} variant={published ? 'filled' : 'outlined'} />
          </Stack>
          <Divider />
          {published ? (
            <MenuItem component="a" href={publicUrl} target="_blank" rel="noopener noreferrer" onClick={() => setCompactAnchor(null)}>
              <ListItemIcon><Globe size={16} /></ListItemIcon>
              {t('Ver catálogo')}
            </MenuItem>
          ) : (
            <MenuItem component="a" href="/preview" target="_blank" rel="noopener noreferrer" onClick={() => setCompactAnchor(null)}>
              <ListItemIcon><Eye size={16} /></ListItemIcon>
              {t('Vista previa')}
            </MenuItem>
          )}
          {published ? (
            canManage && (
              <MenuItem onClick={unpublish} disabled={pending}>
                <ListItemIcon><EyeOff size={16} /></ListItemIcon>
                {t('Despublicar')}
              </MenuItem>
            )
          ) : (
            <MenuItem onClick={publish} disabled={pending || Boolean(blocked)}>
              <ListItemIcon><Rocket size={16} /></ListItemIcon>
              {pending ? t('Publicando…') : t('Publicar')}
            </MenuItem>
          )}
          {!published && blocked && (
            // El motivo, visible (en el móvil no hay tooltip al pasar el mouse).
            <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 2, pt: 0.5, pb: 1, maxWidth: 280 }}>
              {blocked}
            </Typography>
          )}
        </Menu>
      </Box>
    </>
  );
}
