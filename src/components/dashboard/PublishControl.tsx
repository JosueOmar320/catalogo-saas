'use client';

import { Button, Chip, ListItemIcon, Menu, MenuItem, Stack, Tooltip } from '@mui/material';
import { ChevronDown, EyeOff, Globe, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { publishCatalog, unpublishCatalog } from '@/features/catalog/actions';
import { useT } from '@/i18n/client';
import { STATUS_LABELS } from '@/lib/catalog/status';
import { useAction } from '@/lib/hooks/use-action';
import { useDashboard } from './DashboardContext';

/** Estado del catálogo + acción principal de publicar. */
export function PublishControl() {
  const t = useT();
  const { catalogStatus, publicUrl, canManage, demo } = useDashboard();
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const status = STATUS_LABELS[catalogStatus];

  const publish = () => run(publishCatalog, { onSuccess: () => router.refresh() });
  const unpublish = async () => {
    setAnchor(null);
    const ok = await confirm({
      title: t('¿Despublicar el catálogo?'),
      description: t('Quien tenga el enlace verá una página de "catálogo no disponible" hasta que vuelvas a publicarlo. No se borra nada.'),
      confirmLabel: t('Despublicar'),
      destructive: true,
    });
    if (ok) await run(unpublishCatalog, { onSuccess: () => router.refresh() });
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Chip label={t(status.label)} color={status.color} variant={catalogStatus === 'published' ? 'filled' : 'outlined'} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
      {catalogStatus === 'published' ? (
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
          <Tooltip title={demo ? t('En la cuenta de prueba el sitio no se publica. Usa «Vista previa» para verlo como tus clientes.') : canManage ? '' : t('Sólo el dueño o un administrador puede publicar')}>
            <span>
              <Button variant="contained" startIcon={<Rocket size={14} />} onClick={publish} disabled={pending || !canManage || demo}>
                {pending ? t('Publicando…') : t('Publicar')}
              </Button>
            </span>
          </Tooltip>
        </>
      )}
    </Stack>
  );
}
