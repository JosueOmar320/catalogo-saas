'use client';

import { Avatar, Box, ButtonBase, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { ChevronsUpDown, LayoutGrid, LogOut, Shield, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { signOut } from '@/features/auth/actions';
import { useT } from '@/i18n/client';

type Props = {
  username: string;
  fullName: string | null;
  isAdmin: boolean;
  /** Mostrar "Mis negocios" (panel de negocio). */
  showDashboard?: boolean;
};

/** Cuenta del usuario: nombre, "Mi cuenta", acceso al panel de administración y salir. */
export function AccountMenu({ username, fullName, isAdmin, showDashboard = true }: Props) {
  const t = useT();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ width: '100%', justifyContent: 'flex-start', gap: 1.25, p: 1, borderRadius: 1.5, textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main' }}>{(fullName || username).charAt(0).toUpperCase()}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{fullName || username}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="p">@{username}{isAdmin ? ` · ${t('Administrador')}` : ''}</Typography>
        </Box>
        <ChevronsUpDown size={14} />
      </ButtonBase>
      <AccountMenuItems anchor={anchor} onClose={() => setAnchor(null)} isAdmin={isAdmin} showDashboard={showDashboard} />
    </>
  );
}

export function AccountMenuItems({ anchor, onClose, isAdmin, showDashboard, children }: { anchor: HTMLElement | null; onClose: () => void; isAdmin: boolean; showDashboard?: boolean; children?: React.ReactNode }) {
  const t = useT();
  return (
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{ paper: { sx: { width: 250 } } }}
    >
      {children}
      {isAdmin && (
        <MenuItem component={Link} href="/admin" onClick={onClose}>
          <ListItemIcon><Shield size={16} /></ListItemIcon>
          <ListItemText primary={t('Panel de administración')} slotProps={{ primary: { variant: 'body2' } }} />
        </MenuItem>
      )}
      {showDashboard && (
        <MenuItem component={Link} href="/dashboard" onClick={onClose}>
          <ListItemIcon><LayoutGrid size={16} /></ListItemIcon>
          <ListItemText primary={t('Mis negocios')} slotProps={{ primary: { variant: 'body2' } }} />
        </MenuItem>
      )}
      <MenuItem component={Link} href="/cuenta" onClick={onClose}>
        <ListItemIcon><UserRound size={16} /></ListItemIcon>
        <ListItemText primary={t('Mi cuenta')} slotProps={{ primary: { variant: 'body2' } }} />
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => void signOut()}>
        <ListItemIcon><LogOut size={16} /></ListItemIcon>
        <ListItemText primary={t('Cerrar sesión')} slotProps={{ primary: { variant: 'body2' } }} />
      </MenuItem>
    </Menu>
  );
}
