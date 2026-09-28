'use client';

import { Button, Chip, ListItemIcon, Menu, MenuItem, Stack, Tooltip } from '@mui/material';
import { ChevronDown, EyeOff, Globe, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { publishCatalog, unpublishCatalog } from '@/features/catalog/actions';
import { STATUS_LABELS } from '@/lib/catalog/status';
import { useAction } from '@/lib/hooks/use-action';
import { useDashboard } from './DashboardContext';

/** Estado del catálogo + acción principal de publicar. */
export function PublishControl() {
  const { catalogStatus, publicUrl, canManage } = useDashboard();
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const status = STATUS_LABELS[catalogStatus];

  const publish = () => run(publishCatalog, { onSuccess: () => router.refresh() });
  const unpublish = async () => {
    setAnchor(null);
    const ok = await confirm({
      title: '¿Despublicar el catálogo?',
      description: 'Quien tenga el enlace verá una página de "catálogo no disponible" hasta que vuelvas a publicarlo. No se borra nada.',
      confirmLabel: 'Despublicar',
      destructive: true,
    });
    if (ok) await run(unpublishCatalog, { onSuccess: () => router.refresh() });
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Chip label={status.label} color={status.color} variant={catalogStatus === 'published' ? 'filled' : 'outlined'} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
      {catalogStatus === 'published' ? (
        <>
          <Button variant="outlined" color="inherit" href={publicUrl} target="_blank" startIcon={<Globe size={14} />}>
            Ver catálogo
          </Button>
          {canManage && (
            <>
              <Button color="inherit" onClick={(e) => setAnchor(e.currentTarget)} endIcon={<ChevronDown size={14} />} sx={{ minWidth: 0, px: 1 }} aria-label="Más opciones de publicación" />
              <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                <MenuItem onClick={unpublish} disabled={pending}>
                  <ListItemIcon><EyeOff size={16} /></ListItemIcon>
                  Despublicar
                </MenuItem>
              </Menu>
            </>
          )}
        </>
      ) : (
        <>
          <Button variant="outlined" color="inherit" href="/preview" target="_blank">
            Vista previa
          </Button>
          <Tooltip title={canManage ? '' : 'Sólo el dueño o un administrador puede publicar'}>
            <span>
              <Button variant="contained" startIcon={<Rocket size={14} />} onClick={publish} disabled={pending || !canManage}>
                {pending ? 'Publicando…' : 'Publicar'}
              </Button>
            </span>
          </Tooltip>
        </>
      )}
    </Stack>
  );
}
