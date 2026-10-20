import localFont from 'next/font/local';

/** Fuente de la interfaz del panel (expuesta como --font-app). Self-hosted: el build no descarga nada de Google. */
export const appFont = localFont({ src: '../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', weight: '100 900', variable: '--font-app', display: 'swap' });
