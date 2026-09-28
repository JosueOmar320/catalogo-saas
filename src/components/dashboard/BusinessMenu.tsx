'use client';

import { Avatar, Box, ButtonBase, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { Check, ChevronsUpDown, LogOut, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/features/auth/actions';
import { switchBusiness } from '@/features/business/actions';
import { useAction } from '@/lib/hooks/use-action';

type Props = {
  current: { id: string; name: string; logoUrl: string | null };
  businesses: { id: string; name: string }[];
  email: string | null;
  planName: string;
};

/** Selector de negocio + cuenta. Preparado para usuarios con varios negocios. */
export function BusinessMenu({ current, businesses, email, planName }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const router = useRouter();
  const { run } = useAction();

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ width: '100%', justifyContent: 'flex-start', gap: 1.25, p: 1, borderRadius: 1.5, textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Avatar src={current.logoUrl ?? undefined} variant="rounded" sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'secondary.main' }}>
          {current.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{current.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="p">Plan {planName}</Typography>
        </Box>
        <ChevronsUpDown size={14} />
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 240 } } }}
      >
        <Typography variant="overline" color="text.secondary" sx={{ px: 2 }}>Negocios</Typography>
        {businesses.map((b) => (
          <MenuItem
            key={b.id}
            onClick={() => {
              setAnchor(null);
              if (b.id !== current.id) void run(() => switchBusiness(b.id), { onSuccess: () => router.push('/dashboard') });
            }}
          >
            <ListItemText primary={b.name} slotProps={{ primary: { noWrap: true, variant: 'body2' } }} />
            {b.id === current.id && <Check size={14} />}
          </MenuItem>
        ))}
        <MenuItem onClick={() => router.push('/onboarding?new=1')}>
          <ListItemIcon><Plus size={16} /></ListItemIcon>
          <ListItemText primary="Nuevo negocio" slotProps={{ primary: { variant: 'body2' } }} />
        </MenuItem>
        <Divider />
        {email && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block', pb: 0.5 }} noWrap>
            {email}
          </Typography>
        )}
        <MenuItem onClick={() => void signOut()}>
          <ListItemIcon><LogOut size={16} /></ListItemIcon>
          <ListItemText primary="Cerrar sesión" slotProps={{ primary: { variant: 'body2' } }} />
        </MenuItem>
      </Menu>
    </>
  );
}
