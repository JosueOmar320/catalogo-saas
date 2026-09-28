import {
  Cormorant_Garamond, DM_Sans, Inter, Lato, Merriweather, Montserrat, Oswald, Playfair_Display, Poppins, Roboto, Space_Grotesk,
} from 'next/font/google';
import type { FontId } from '@/lib/design/fonts';

/*
 * Fuentes self-hosted por next/font. `preload: false`: el navegador sólo
 * descarga las fuentes que el tema realmente usa.
 */
// next/font exige argumentos literales (sin spread ni variables).
const inter = Inter({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-inter' });
const roboto = Roboto({ subsets: ['latin'], preload: false, display: 'swap', weight: ['400', '500', '700'], variable: '--font-roboto' });
const poppins = Poppins({ subsets: ['latin'], preload: false, display: 'swap', weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' });
const montserrat = Montserrat({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-montserrat' });
const lato = Lato({ subsets: ['latin'], preload: false, display: 'swap', weight: ['400', '700'], variable: '--font-lato' });
const dmSans = DM_Sans({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-dm-sans' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-space-grotesk' });
const oswald = Oswald({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-oswald' });
const playfair = Playfair_Display({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-playfair' });
const merriweather = Merriweather({ subsets: ['latin'], preload: false, display: 'swap', weight: ['400', '700'], variable: '--font-merriweather' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], preload: false, display: 'swap', weight: ['400', '500', '600', '700'], variable: '--font-cormorant' });

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
