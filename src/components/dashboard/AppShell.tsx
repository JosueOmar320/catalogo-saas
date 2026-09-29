'use client';

import { AppBar, Box, Collapse, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material';
import { ChevronDown, Menu as MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { env } from '@/lib/env';
import { BusinessMenu } from './BusinessMenu';
import { AccountMenu } from './AccountMenu';
import { ADMIN_NAVIGATION, NAVIGATION } from './navigation';
import { PublishControl } from './PublishControl';

const DRAWER_WIDTH = 248;

type Props = {
  children: ReactNode;
} & (
  | { variant?: 'dashboard'; businessMenu: ComponentProps<typeof BusinessMenu> }
  | { variant: 'admin'; account: ComponentProps<typeof AccountMenu> }
);

function isActive(pathname: string, search: string, href: string) {
  const [path, query] = href.split('?');
  if (path === '/dashboard' || path === '/admin') return pathname === path;
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  // Enlaces al mismo editor con distinto panel (?panel=...).
  const panel = new URLSearchParams(query ?? '').get('panel');
  const current = new URLSearchParams(search).get('panel');
  return panel === current || (!panel && !current);
}

/** Pantallas de trabajo a lo ancho (editor del sitio, estudio de PDF). */
const FULL_WIDTH = ['/dashboard/sitio', '/dashboard/export/pdf'];

function SideNav({ onNavigate, admin }: { onNavigate?: () => void; admin?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <List dense sx={{ px: 1.25, py: 1 }}>
      {(admin ? ADMIN_NAVIGATION : NAVIGATION).map((entry) => {
        const Icon = entry.icon;
        if (entry.href) {
          return (
            <ListItemButton key={entry.label} component={Link} href={entry.href} selected={isActive(pathname, search, entry.href)} onClick={onNavigate} sx={{ mb: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 30 }}><Icon size={17} /></ListItemIcon>
              <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontWeight: 600, fontSize: 14 } } }} />
            </ListItemButton>
          );
        }
        const open = !collapsed[entry.label];
        return (
          <Box key={entry.label} sx={{ mb: 0.5 }}>
            <ListItemButton onClick={() => setCollapsed((c) => ({ ...c, [entry.label]: open }))}>
              <ListItemIcon sx={{ minWidth: 30 }}><Icon size={17} /></ListItemIcon>
              <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontWeight: 600, fontSize: 14 } } }} />
              <Box component={ChevronDown} size={14} sx={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', color: 'text.secondary' }} />
            </ListItemButton>
            <Collapse in={open}>
              <List dense disablePadding>
                {entry.children?.map((child) => (
                  <ListItemButton
                    key={child.href}
                    component={Link}
                    href={child.href}
                    selected={isActive(pathname, search, child.href)}
                    onClick={onNavigate}
                    sx={{ pl: 5.25, py: 0.4, '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.dark' } }}
                  >
                    <ListItemText primary={child.label} slotProps={{ primary: { sx: { fontSize: 13.5 } } }} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </Box>
        );
      })}
    </List>
  );
}

export function AppShell(props: Props) {
  const { children } = props;
  const admin = props.variant === 'admin';
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const fullWidth = FULL_WIDTH.some((p) => pathname.startsWith(p));

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 2.5, minHeight: '56px !important' }}>
        <Typography component={Link} href={admin ? '/admin' : '/dashboard'} sx={{ fontWeight: 750, fontSize: 17, letterSpacing: '-0.02em', color: 'text.primary', textDecoration: 'none' }}>
          {env.appName}
        </Typography>
        {admin && <Typography component="span" sx={{ ml: 1, px: 0.75, py: 0.1, borderRadius: 1, fontSize: 11, fontWeight: 700, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}>ADMIN</Typography>}
      </Toolbar>
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <SideNav onNavigate={() => setMobileOpen(false)} admin={admin} />
      </Box>
      <Box sx={{ p: 1.25, borderTop: 1, borderColor: 'divider' }}>
        {props.variant === 'admin' ? <AccountMenu {...props.account} /> : <BusinessMenu {...props.businessMenu} />}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 1, borderColor: 'divider' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
          <Toolbar sx={{ minHeight: '56px !important', gap: 1, px: { xs: 1.5, sm: 3 } }}>
            <IconButton onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' } }} aria-label="Abrir menú">
              <MenuIcon size={18} />
            </IconButton>
            <Box sx={{ flex: 1 }} />
            {!admin && <PublishControl />}
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, p: fullWidth ? 2 : { xs: 2, sm: 3 }, pb: fullWidth ? 2 : 12, width: '100%', maxWidth: fullWidth ? 'none' : 1240, mx: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
