'use client';

import { createTheme } from '@mui/material/styles';
// Tipos de `theme.vars` (CSS variables) siempre definidos en estilos y `sx`.
import type {} from '@mui/material/themeCssVarsAugmentation';
import { appFont } from './app-font';
import { COLOR_SCHEME_ATTRIBUTE } from './color-mode';

/**
 * Tema del panel: compacto, sobrio, pocos colores, bordes en vez de sombras.
 * El catálogo público NO usa este tema (tiene su propio sistema de estilos).
 *
 * Claro y oscuro con CSS variables: el esquema se elige con la clase `light` /
 * `dark` del <html> (la pone InitColorSchemeScript antes de pintar, sin
 * destello). En estilos propios usar `theme.vars.palette.*` o tokens de `sx`
 * ('divider', 'text.secondary'…), nunca colores fijos.
 */
export const dashboardTheme = createTheme({
  cssVariables: { colorSchemeSelector: COLOR_SCHEME_ATTRIBUTE },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#2F54D6', dark: '#2443B3', light: '#E8EDFC', contrastText: '#FFFFFF' },
        secondary: { main: '#18181B', contrastText: '#FFFFFF' },
        success: { main: '#15803D', light: '#DCFCE7' },
        warning: { main: '#B45309', light: '#FEF3C7' },
        error: { main: '#DC2626' },
        background: { default: '#F7F7F8', paper: '#FFFFFF' },
        text: { primary: '#18181B', secondary: '#61616B' },
        divider: '#E4E4E7',
      },
    },
    dark: {
      palette: {
        // Azul más claro para mantener contraste sobre fondos oscuros; `light` es un tinte profundo (se usa como fondo suave).
        primary: { main: '#7C9BFF', dark: '#5B7CF0', light: '#1C2747', contrastText: '#0B1020' },
        secondary: { main: '#E4E4E7', contrastText: '#18181B' },
        success: { main: '#4ADE80', light: '#12301F' },
        warning: { main: '#FBBF24', light: '#3A2A0B' },
        error: { main: '#F87171' },
        background: { default: '#0E1014', paper: '#16181D' },
        text: { primary: '#ECECEF', secondary: '#A1A1AA' },
        divider: '#2A2D35',
      },
    },
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
      styleOverrides: {
        outlined: ({ theme }) => ({ borderColor: theme.vars.palette.divider }),
        // En oscuro MUI aclara el Paper con un degradado según la elevación; aquí se usan bordes, no sombras.
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiChip: { defaultProps: { size: 'small' }, styleOverrides: { root: { fontWeight: 500 } } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: 40, fontWeight: 600 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 40 } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.875rem' } } },
    MuiSwitch: { defaultProps: { size: 'small' } },
    // Sin seleccionar, el gris de MUI queda justo bajo el contraste mínimo (4.5:1): se usa el texto secundario.
    MuiToggleButton: { styleOverrides: { root: ({ theme }) => ({ color: theme.palette.text.secondary }) } },
    MuiAlert: { styleOverrides: { root: { alignItems: 'center' } } },
  },
});
