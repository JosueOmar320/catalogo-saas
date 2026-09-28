/**
 * Registro de fuentes. Para agregar una fuente:
 * 1. Agrégala aquí (id de Fontsource para el PDF).
 * 2. Declárala con next/font en src/site-renderer/fonts.ts (TypeScript lo exige).
 */
export const FONT_IDS = [
  'inter',
  'roboto',
  'poppins',
  'montserrat',
  'lato',
  'dm-sans',
  'space-grotesk',
  'oswald',
  'playfair-display',
  'merriweather',
  'cormorant-garamond',
] as const;

export type FontId = (typeof FONT_IDS)[number];

type FontMeta = {
  label: string;
  category: 'sans' | 'serif' | 'display';
  /** Id en Fontsource, usado para cargar los TTF del PDF. */
  fontsourceId: string;
};

export const FONTS: Record<FontId, FontMeta> = {
  inter: { label: 'Inter', category: 'sans', fontsourceId: 'inter' },
  roboto: { label: 'Roboto', category: 'sans', fontsourceId: 'roboto' },
  poppins: { label: 'Poppins', category: 'sans', fontsourceId: 'poppins' },
  montserrat: { label: 'Montserrat', category: 'sans', fontsourceId: 'montserrat' },
  lato: { label: 'Lato', category: 'sans', fontsourceId: 'lato' },
  'dm-sans': { label: 'DM Sans', category: 'sans', fontsourceId: 'dm-sans' },
  'space-grotesk': { label: 'Space Grotesk', category: 'sans', fontsourceId: 'space-grotesk' },
  oswald: { label: 'Oswald', category: 'display', fontsourceId: 'oswald' },
  'playfair-display': { label: 'Playfair Display', category: 'serif', fontsourceId: 'playfair-display' },
  merriweather: { label: 'Merriweather', category: 'serif', fontsourceId: 'merriweather' },
  'cormorant-garamond': { label: 'Cormorant Garamond', category: 'serif', fontsourceId: 'cormorant-garamond' },
};
