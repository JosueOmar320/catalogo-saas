'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { ReactNode } from 'react';
import { ConfirmProvider } from '@/components/feedback/ConfirmProvider';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { MODE_STORAGE_KEY } from './color-mode';
import { dashboardTheme } from './theme';

/** Providers del panel y de auth. El catálogo público no los carga. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={dashboardTheme} modeStorageKey={MODE_STORAGE_KEY} defaultMode="system">
        <CssBaseline />
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
