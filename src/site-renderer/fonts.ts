import localFont from 'next/font/local';
import type { FontId } from '@/lib/design/fonts';

/*
 * Fuentes self-hosted con next/font/local, desde los paquetes de Fontsource
 * (sin descargar nada de Google al compilar: el build no depende de la red).
 * Sólo el subconjunto latino; variables donde existen. `preload: false`: el
 * navegador sólo descarga las fuentes que el tema realmente usa.
 */
// next/font exige argumentos literales (sin spread ni variables); las rutas son relativas a este archivo.
const inter = localFont({ src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', weight: '100 900', preload: false, display: 'swap', variable: '--font-inter' });
const roboto = localFont({ src: '../../node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2', weight: '100 900', preload: false, display: 'swap', variable: '--font-roboto' });
const poppins = localFont({
  src: [
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  preload: false,
  display: 'swap',
  variable: '--font-poppins',
});
const montserrat = localFont({ src: '../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2', weight: '100 900', preload: false, display: 'swap', variable: '--font-montserrat' });
const lato = localFont({
  src: [
    { path: '../../node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  preload: false,
  display: 'swap',
  variable: '--font-lato',
});
const dmSans = localFont({ src: '../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2', weight: '100 1000', preload: false, display: 'swap', variable: '--font-dm-sans' });
const spaceGrotesk = localFont({ src: '../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2', weight: '300 700', preload: false, display: 'swap', variable: '--font-space-grotesk' });
const oswald = localFont({ src: '../../node_modules/@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2', weight: '200 700', preload: false, display: 'swap', variable: '--font-oswald' });
const playfair = localFont({
  src: '../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2',
  weight: '400 900',
  preload: false,
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  variable: '--font-playfair',
});
const merriweather = localFont({
  src: [
    { path: '../../node_modules/@fontsource/merriweather/files/merriweather-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/merriweather/files/merriweather-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  preload: false,
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  variable: '--font-merriweather',
});
const cormorant = localFont({
  src: '../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2',
  weight: '300 700',
  preload: false,
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  variable: '--font-cormorant',
});

/** TypeScript exige una entrada por cada FontId del registro. */
export const FONT_FAMILIES: Record<FontId, string> = {
  inter: inter.style.fontFamily,
  roboto: roboto.style.fontFamily,
  poppins: poppins.style.fontFamily,
  montserrat: montserrat.style.fontFamily,
  lato: lato.style.fontFamily,
  'dm-sans': dmSans.style.fontFamily,
  'space-grotesk': spaceGrotesk.style.fontFamily,
  oswald: oswald.style.fontFamily,
  'playfair-display': playfair.style.fontFamily,
  merriweather: merriweather.style.fontFamily,
  'cormorant-garamond': cormorant.style.fontFamily,
};
