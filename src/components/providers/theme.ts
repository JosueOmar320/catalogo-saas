'use client';

import { createTheme } from '@mui/material/styles';
import { appFont } from './app-font';

/**
 * Tema del panel: compacto, sobrio, pocos colores, bordes en vez de sombras.
 * El catálogo público NO usa este tema (tiene su propio sistema de estilos).
 */
const border = '#E4E4E7';

export const dashboardTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2F54D6', dark: '#2443B3', light: '#E8EDFC', contrastText: '#FFFFFF' },
    secondary: { main: '#18181B' },
    success: { main: '#15803D', light: '#DCFCE7' },
    warning: { main: '#B45309', light: '#FEF3C7' },
    error: { main: '#DC2626' },
    background: { default: '#F7F7F8', paper: '#FFFFFF' },
    text: { primary: '#18181B', secondary: '#61616B' },
    divider: border,
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: `${appFont.style.fontFamily}, system-ui, -apple-system, sans-serif`,
    fontSize: 14,
    h1: { fontSize: '1.5rem', fontWeight: 650, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.25rem', fontWeight: 650, letterSpacing: '-0.01em' },
    h3: { fontSize: '1rem', fontWeight: 650 },
    h4: { fontSize: '0.9375rem', fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: '0.06em', fontSize: '0.6875rem' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true, size: 'small' },
      styleOverrides: { root: { paddingInline: 12, minHeight: 34 } },
    },
    MuiIconButton: { defaultProps: { size: 'small' } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { outlined: { borderColor: border } },
    },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiChip: { defaultProps: { size: 'small' }, styleOverrides: { root: { fontWeight: 500 } } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: 40, fontWeight: 600 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 40 } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.875rem' } } },
    MuiSwitch: { defaultProps: { size: 'small' } },
    MuiAlert: { styleOverrides: { root: { alignItems: 'center' } } },
  },
});
