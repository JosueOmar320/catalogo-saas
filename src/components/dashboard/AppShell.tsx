'use client';

import { AppBar, Box, ButtonBase, Collapse, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material';
import { ChevronDown, Menu as MenuIcon, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { ColorModeToggle } from '@/components/ui/ColorModeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useT } from '@/i18n/client';
import { env } from '@/lib/env';
import { BusinessMenu } from './BusinessMenu';
import { AccountMenu } from './AccountMenu';
import { CommandPalette, OPEN_PALETTE_EVENT } from './CommandPalette';
import { PanelGarfield } from '@/features/assistant/components/PanelGarfield';
import { ALL_FEATURES, type BusinessFeatures } from '@/lib/plans/features';
import { ADMIN_NAVIGATION, navigationFor } from './navigation';
import type { SiteKind } from '@/lib/business/site-kind';
import { PublishControl } from './PublishControl';

const DRAWER_WIDTH = 248;

type Props = {
  children: ReactNode;
} & (
  | { variant?: 'dashboard'; businessMenu: ComponentProps<typeof BusinessMenu>; siteKind?: SiteKind; features?: BusinessFeatures }
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

function SideNav({ onNavigate, admin, siteKind = 'catalog', features = ALL_FEATURES }: { onNavigate?: () => void; admin?: boolean; siteKind?: SiteKind; features?: BusinessFeatures }) {
  const t = useT();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    // <nav> y no <ul>: los enlaces van directos (una lista exige <li> como hijos).
    <List component="nav" aria-label={admin ? t('Menú de administración') : t('Menú principal')} dense sx={{ px: 1.25, py: 1 }}>
      {(admin ? ADMIN_NAVIGATION : navigationFor(siteKind, features)).map((entry) => {
        const Icon = entry.icon;
        if (entry.href) {
          return (
            <ListItemButton
              key={entry.label}
              component={Link}
              href={entry.href}
              selected={isActive(pathname, search, entry.href)}
              aria-current={isActive(pathname, search, entry.href) ? 'page' : undefined}
              onClick={onNavigate}
              sx={{ mb: 0.25 }}
            >
              <ListItemIcon sx={{ minWidth: 30 }}><Icon size={17} /></ListItemIcon>
              <ListItemText primary={t(entry.label)} slotProps={{ primary: { sx: { fontWeight: 600, fontSize: 14 } } }} />
            </ListItemButton>
          );
        }
        const open = !collapsed[entry.label];
        return (
          <Box key={entry.label} sx={{ mb: 0.5 }}>
            <ListItemButton aria-expanded={open} onClick={() => setCollapsed((c) => ({ ...c, [entry.label]: open }))}>
              <ListItemIcon sx={{ minWidth: 30 }}><Icon size={17} /></ListItemIcon>
              <ListItemText primary={t(entry.label)} slotProps={{ primary: { sx: { fontWeight: 600, fontSize: 14 } } }} />
              <Box component={ChevronDown} size={14} sx={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', color: 'text.secondary' }} />
            </ListItemButton>
            <Collapse in={open}>
              <List component="div" dense disablePadding>
                {entry.children?.map((child) => (
                  <ListItemButton
                    key={child.href}
                    component={Link}
                    href={child.href}
                    selected={isActive(pathname, search, child.href)}
                    aria-current={isActive(pathname, search, child.href) ? 'page' : undefined}
                    onClick={onNavigate}
                    sx={{ pl: 5.25, py: 0.4, '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.dark' } }}
                  >
                    <ListItemText primary={t(child.label)} slotProps={{ primary: { sx: { fontSize: 13.5 } } }} />
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
  const t = useT();
  const admin = props.variant === 'admin';
  const siteKind = props.variant === 'admin' ? 'catalog' : (props.siteKind ?? 'catalog');
  const features = props.variant === 'admin' ? ALL_FEATURES : (props.features ?? ALL_FEATURES);
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
        <SideNav onNavigate={() => setMobileOpen(false)} admin={admin} siteKind={siteKind} features={features} />
      </Box>
      <Box sx={{ p: 1.25, borderTop: 1, borderColor: 'divider' }}>
        {props.variant === 'admin' ? <AccountMenu {...props.account} /> : <BusinessMenu {...props.businessMenu} />}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Enlace para teclado: aparece al enfocarlo y salta la navegación. */}
      <Box
        component="a"
        href="#contenido"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 'tooltip',
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          fontWeight: 600,
          textDecoration: 'none',
          transform: 'translateY(-200%)',
          '&:focus-visible': { transform: 'none' },
        }}
      >
        {t('Saltar al contenido')}
      </Box>
      <Box component="nav" aria-label={t('Navegación del panel')} sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
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
        <AppBar position="sticky" color="inherit" elevation={0} sx={(theme) => ({ borderBottom: 1, borderColor: 'divider', bgcolor: `rgba(${theme.vars.palette.background.paperChannel} / 0.9)`, backdropFilter: 'blur(8px)' })}>
          <Toolbar sx={{ minHeight: '56px !important', gap: 1, px: { xs: 1.5, sm: 3 } }}>
            <IconButton onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' } }} aria-label={t('Abrir menú')}>
              <MenuIcon size={18} />
            </IconButton>
            <SearchTrigger />
            {!admin && features.assistant && <PanelGarfield />}
            <LanguageSwitcher />
            <ColorModeToggle />
            {!admin && <PublishControl />}
          </Toolbar>
        </AppBar>
        <CommandPalette admin={admin} siteKind={siteKind} features={features} />
        <Box component="main" id="contenido" tabIndex={-1} sx={{ outline: 'none', flex: 1, p: fullWidth ? 2 : { xs: 2, sm: 3 }, pb: fullWidth ? 2 : 12, width: '100%', maxWidth: fullWidth ? 'none' : 1240, mx: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

const noSubscribe = () => () => {};

/** Abre la búsqueda rápida. En escritorio parece un campo con el atajo; en móvil, un ícono. */
function SearchTrigger() {
  const t = useT();
  const shortcut = useSyncExternalStore(noSubscribe, () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'), () => 'Ctrl K');
  const open = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
  return (
    <Box sx={{ flex: 1, display: 'flex' }}>
      <ButtonBase
        onClick={open}
        aria-label={t('Buscar ({shortcut})', { shortcut })}
        aria-keyshortcuts="Meta+K Control+K"
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 1,
          width: 280,
          px: 1.5,
          py: 0.75,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          color: 'text.secondary',
          fontSize: 14,
          justifyContent: 'flex-start',
          '&:hover': { borderColor: 'text.secondary' },
        }}
      >
        <Search size={15} aria-hidden />
        <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>{t('Buscar…')}</Box>
        <Box component="kbd" sx={{ fontFamily: 'inherit', fontSize: 12, border: 1, borderColor: 'divider', borderRadius: 0.75, px: 0.5 }}>{shortcut}</Box>
      </ButtonBase>
      <IconButton onClick={open} aria-label={t('Buscar')} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
        <Search size={18} />
      </IconButton>
    </Box>
  );
}

