import { deepMerge, type PlainObject } from '@/lib/utils/object';
import { msg } from '@/i18n/translate';
import { themeSchema, type ThemeConfig, type ThemeInput } from './theme';

/**
 * Temas iniciales. Un preset es SOLO un punto de partida: define colores,
 * tipografía, navbar, tarjetas, botones, fondo y espaciado; todo se puede
 * cambiar después. Las preferencias de contenido (qué mostrar en tarjetas,
 * textos del footer, etiquetas de badges) se conservan al aplicarlo.
 */
export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  /** Colores para la miniatura del selector. */
  swatch: [string, string, string];
  theme: ThemeInput;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'minimal',
    name: msg('Minimal'),
    description: msg('Blanco, negro y mucho aire. Funciona con cualquier marca.'),
    swatch: ['#FFFFFF', '#111111', '#E5E5E5'],
    theme: {
      colors: { primary: '#111111', secondary: '#6B6B6B', accent: '#111111', background: '#FFFFFF', surface: '#FFFFFF', text: '#1A1A1A', mutedText: '#6B6B6B', border: '#E7E7E7', heading: '#0A0A0A', button: '#111111', buttonText: '#FFFFFF', price: '#111111' },
      typography: { bodyFont: 'inter', headingFont: 'inter', priceFont: 'inter', headingScale: 'md', headingWeight: '600', headingLetterSpacing: -0.02, headingCase: 'none', lineHeight: 1.6 },
      spacing: { sectionPadding: 'relaxed', gap: 'normal', maxWidth: 'normal' },
      shape: { radius: 4, borderWidth: 1, shadow: 'none' },
      buttons: { style: 'solid', shape: 'rounded', size: 'md', hover: 'darken', uppercase: false, shadow: false },
      background: { type: 'color', color: '#FFFFFF' },
      header: { style: 'minimal', logoPosition: 'left', menuPosition: 'right' },
      footer: { style: 'simple' },
      cards: { style: 'minimal', imagePosition: 'top', imageRatio: 'square', hover: 'zoom', align: 'left' },
      badges: { style: 'solid', shape: 'square' },
    },
  },
  {
    id: 'elegant',
    name: msg('Elegante'),
    description: msg('Tonos cálidos, serif clásica y detalles finos.'),
    swatch: ['#FBF8F4', '#7A5C3E', '#B08D57'],
    theme: {
      colors: { primary: '#7A5C3E', secondary: '#A8927C', accent: '#B08D57', background: '#FBF8F4', surface: '#FFFFFF', text: '#2A2420', mutedText: '#7D7268', border: '#E8DFD4', heading: '#2A2420', button: '#2A2420', buttonText: '#FBF8F4', price: '#7A5C3E' },
      typography: { bodyFont: 'lato', headingFont: 'playfair-display', priceFont: 'playfair-display', headingScale: 'lg', headingWeight: '500', headingLetterSpacing: 0, headingCase: 'none', lineHeight: 1.7 },
      spacing: { sectionPadding: 'spacious', gap: 'loose', maxWidth: 'normal' },
      shape: { radius: 2, borderWidth: 1, shadow: 'none' },
      buttons: { style: 'outline', shape: 'square', size: 'md', hover: 'darken', uppercase: true, shadow: false },
      background: { type: 'color', color: '#FBF8F4' },
      header: { style: 'elegant', logoPosition: 'center', menuPosition: 'center' },
      footer: { style: 'centered' },
      cards: { style: 'elegant', imagePosition: 'top', imageRatio: 'portrait', hover: 'zoom', align: 'center' },
      badges: { style: 'outline', shape: 'square' },
    },
  },
  {
    id: 'restaurant',
    name: msg('Restaurante'),
    description: msg('Textura de papel, terracota y serif. Menús y cafeterías.'),
    swatch: ['#FBF6F0', '#B4532A', '#D9A441'],
    theme: {
      colors: { primary: '#B4532A', secondary: '#D9A441', accent: '#D9A441', background: '#FBF6F0', surface: '#FFFFFF', text: '#2B1D14', mutedText: '#7A6558', border: '#EADBCB', heading: '#2B1D14', button: '#B4532A', buttonText: '#FFFFFF', price: '#B4532A' },
      typography: { bodyFont: 'lato', headingFont: 'playfair-display', priceFont: 'lato', headingScale: 'lg', headingWeight: '700', headingLetterSpacing: -0.01, headingCase: 'none', lineHeight: 1.6 },
      spacing: { sectionPadding: 'normal', gap: 'normal', maxWidth: 'normal' },
      shape: { radius: 10, borderWidth: 1, shadow: 'soft' },
      buttons: { style: 'solid', shape: 'pill', size: 'md', hover: 'lift', uppercase: false, shadow: false },
      background: { type: 'pattern', color: '#FBF6F0', pattern: { id: 'paper', color: '#B4532A', opacity: 10, scale: 1 } },
      header: { style: 'centered', logoPosition: 'center', menuPosition: 'center' },
      footer: { style: 'dark' },
      cards: { style: 'imageFocus', imagePosition: 'top', imageRatio: 'landscape', hover: 'zoom', align: 'left' },
      badges: { style: 'solid', shape: 'pill' },
    },
  },
  {
    id: 'fashion',
    name: msg('Moda'),
    description: msg('Editorial, fotos verticales y mayúsculas espaciadas.'),
    swatch: ['#FFFFFF', '#111111', '#C8B6A6'],
    theme: {
      colors: { primary: '#111111', secondary: '#C8B6A6', accent: '#111111', background: '#FFFFFF', surface: '#F7F5F3', text: '#161616', mutedText: '#727272', border: '#E6E1DC', heading: '#111111', button: '#111111', buttonText: '#FFFFFF', price: '#111111' },
      typography: { bodyFont: 'dm-sans', headingFont: 'cormorant-garamond', priceFont: 'dm-sans', headingScale: 'xl', headingWeight: '500', headingLetterSpacing: 0.06, headingCase: 'uppercase', lineHeight: 1.6 },
      spacing: { sectionPadding: 'relaxed', gap: 'loose', maxWidth: 'wide' },
      shape: { radius: 0, borderWidth: 1, shadow: 'none' },
      buttons: { style: 'outline', shape: 'square', size: 'md', hover: 'darken', uppercase: true, shadow: false },
      background: { type: 'color', color: '#FFFFFF' },
      header: { style: 'transparent', logoPosition: 'center', menuPosition: 'center' },
      footer: { style: 'centered' },
      cards: { style: 'borderless', imagePosition: 'top', imageRatio: 'portrait', hover: 'zoom', align: 'left', button: 'link' },
      badges: { style: 'solid', shape: 'square' },
    },
  },
  {
    id: 'corporate',
    name: msg('Corporativo'),
    description: msg('Azul confiable, ordenado. Servicios profesionales y salud.'),
    swatch: ['#F5F8FB', '#1D5FA8', '#0F2233'],
    theme: {
      colors: { primary: '#1D5FA8', secondary: '#7FA7D1', accent: '#1D5FA8', background: '#F5F8FB', surface: '#FFFFFF', text: '#1B2B3A', mutedText: '#5B6B7B', border: '#DCE4ED', heading: '#0F2233', button: '#1D5FA8', buttonText: '#FFFFFF', price: '#1D5FA8' },
      typography: { bodyFont: 'inter', headingFont: 'inter', priceFont: 'inter', headingScale: 'md', headingWeight: '700', headingLetterSpacing: -0.02, headingCase: 'none', lineHeight: 1.6 },
      spacing: { sectionPadding: 'normal', gap: 'normal', maxWidth: 'normal' },
      shape: { radius: 8, borderWidth: 1, shadow: 'soft' },
      buttons: { style: 'solid', shape: 'rounded', size: 'md', hover: 'darken', uppercase: false, shadow: true },
      background: { type: 'color', color: '#F5F8FB' },
      header: { style: 'classic', logoPosition: 'left', menuPosition: 'right' },
      footer: { style: 'dark' },
      cards: { style: 'classic', imagePosition: 'top', imageRatio: 'landscape', hover: 'shadow', align: 'left' },
      badges: { style: 'soft', shape: 'pill' },
    },
  },
  {
    id: 'modern',
    name: msg('Moderno'),
    description: msg('Esquinas amplias, sombras suaves y tipografía geométrica.'),
    swatch: ['#F4F4F7', '#5B5BD6', '#15151A'],
    theme: {
      colors: { primary: '#5B5BD6', secondary: '#A5A5F0', accent: '#5B5BD6', background: '#F4F4F7', surface: '#FFFFFF', text: '#1C1C22', mutedText: '#6A6A75', border: '#E3E3EA', heading: '#15151A', button: '#5B5BD6', buttonText: '#FFFFFF', price: '#15151A' },
      typography: { bodyFont: 'inter', headingFont: 'space-grotesk', priceFont: 'space-grotesk', headingScale: 'lg', headingWeight: '700', headingLetterSpacing: -0.03, headingCase: 'none', lineHeight: 1.55 },
      spacing: { sectionPadding: 'relaxed', gap: 'normal', maxWidth: 'normal' },
      shape: { radius: 16, borderWidth: 0, shadow: 'medium' },
      buttons: { style: 'solid', shape: 'pill', size: 'md', hover: 'lift', uppercase: false, shadow: true },
      background: { type: 'gradient', gradient: { kind: 'linear', angle: 180, from: '#F4F4F7', to: '#ECECF6' } },
      header: { style: 'modern', logoPosition: 'left', menuPosition: 'center' },
      footer: { style: 'columns' },
      cards: { style: 'modern', imagePosition: 'top', imageRatio: 'square', hover: 'lift', align: 'left' },
      badges: { style: 'soft', shape: 'pill' },
    },
  },
  {
    id: 'dark',
    name: msg('Oscuro'),
    description: msg('Fondo oscuro con acentos dorados. Bares, tecnología y noche.'),
    swatch: ['#0F1115', '#E8C07D', '#171A21'],
    theme: {
      colors: { primary: '#E8C07D', secondary: '#9AA0A6', accent: '#E8C07D', background: '#0F1115', surface: '#171A21', text: '#E6E6E6', mutedText: '#9AA0A6', border: '#2A2F3A', heading: '#FFFFFF', button: '#E8C07D', buttonText: '#111111', price: '#E8C07D' },
      typography: { bodyFont: 'inter', headingFont: 'montserrat', priceFont: 'montserrat', headingScale: 'md', headingWeight: '700', headingLetterSpacing: -0.01, headingCase: 'none', lineHeight: 1.6 },
      spacing: { sectionPadding: 'normal', gap: 'normal', maxWidth: 'normal' },
      shape: { radius: 10, borderWidth: 1, shadow: 'none' },
      buttons: { style: 'solid', shape: 'rounded', size: 'md', hover: 'lift', uppercase: false, shadow: false },
      background: { type: 'color', color: '#0F1115' },
      header: { style: 'dark', logoPosition: 'left', menuPosition: 'right' },
      footer: { style: 'dark' },
      cards: { style: 'modern', imagePosition: 'top', imageRatio: 'square', hover: 'lift', align: 'left' },
      badges: { style: 'solid', shape: 'pill' },
    },
  },
  {
    id: 'luxury',
    name: msg('Lujo'),
    description: msg('Negro profundo, dorado y serif en mayúsculas. Alta gama.'),
    swatch: ['#0E0E0E', '#C9A45C', '#1A1A1A'],
    theme: {
      colors: { primary: '#C9A45C', secondary: '#8C7A5B', accent: '#C9A45C', background: '#0E0E0E', surface: '#161616', text: '#E9E4DA', mutedText: '#A39C90', border: '#3A3326', heading: '#F5EBDD', button: '#C9A45C', buttonText: '#0E0E0E', price: '#C9A45C' },
      typography: { bodyFont: 'lato', headingFont: 'cormorant-garamond', priceFont: 'cormorant-garamond', headingScale: 'xl', headingWeight: '500', headingLetterSpacing: 0.1, headingCase: 'uppercase', lineHeight: 1.7 },
      spacing: { sectionPadding: 'spacious', gap: 'loose', maxWidth: 'normal' },
      shape: { radius: 0, borderWidth: 1, shadow: 'none' },
      buttons: { style: 'outline', shape: 'square', size: 'lg', hover: 'darken', uppercase: true, shadow: false },
      background: { type: 'pattern', color: '#0E0E0E', pattern: { id: 'diagonal', color: '#C9A45C', opacity: 5, scale: 1.5 } },
      header: { style: 'elegant', logoPosition: 'center', menuPosition: 'center' },
      footer: { style: 'centered' },
      cards: { style: 'elegant', imagePosition: 'top', imageRatio: 'portrait', hover: 'zoom', align: 'center', button: 'link' },
      badges: { style: 'outline', shape: 'square' },
    },
  },
  {
    id: 'colorful',
    name: msg('Colorido'),
    description: msg('Alegre, con puntos y botones redondeados. Infantil, dulces, regalos.'),
    swatch: ['#FFF8EE', '#FF5A5F', '#00A699'],
    theme: {
      colors: { primary: '#FF5A5F', secondary: '#FFB400', accent: '#00A699', background: '#FFF8EE', surface: '#FFFFFF', text: '#2D2A32', mutedText: '#6E6874', border: '#F3E3CF', heading: '#2D2A32', button: '#FF5A5F', buttonText: '#FFFFFF', price: '#00A699' },
      typography: { bodyFont: 'poppins', headingFont: 'poppins', priceFont: 'poppins', headingScale: 'lg', headingWeight: '800', headingLetterSpacing: -0.02, headingCase: 'none', lineHeight: 1.6 },
      spacing: { sectionPadding: 'normal', gap: 'normal', maxWidth: 'normal' },
      shape: { radius: 20, borderWidth: 0, shadow: 'soft' },
      buttons: { style: 'solid', shape: 'pill', size: 'md', hover: 'grow', uppercase: false, shadow: true },
      background: { type: 'pattern', color: '#FFF8EE', pattern: { id: 'dots', color: '#FF5A5F', opacity: 14, scale: 1.2 } },
      header: { style: 'modern', logoPosition: 'left', menuPosition: 'right' },
      footer: { style: 'columns' },
      cards: { style: 'modern', imagePosition: 'top', imageRatio: 'square', hover: 'lift', align: 'center' },
      badges: { style: 'solid', shape: 'pill' },
    },
  },
  {
    id: 'industrial',
    name: msg('Industrial'),
    description: msg('Contraste fuerte, amarillo de seguridad y cuadrícula. Talleres y ferreterías.'),
    swatch: ['#EFEEEA', '#1E1E1E', '#F2B705'],
    theme: {
      colors: { primary: '#F2B705', secondary: '#5A5A5A', accent: '#F2B705', background: '#EFEEEA', surface: '#FFFFFF', text: '#1E1E1E', mutedText: '#5A5A5A', border: '#1E1E1E', heading: '#1E1E1E', button: '#1E1E1E', buttonText: '#F2B705', price: '#1E1E1E' },
      typography: { bodyFont: 'roboto', headingFont: 'oswald', priceFont: 'oswald', headingScale: 'lg', headingWeight: '700', headingLetterSpacing: 0.02, headingCase: 'uppercase', lineHeight: 1.55 },
      spacing: { sectionPadding: 'normal', gap: 'tight', maxWidth: 'wide' },
      shape: { radius: 0, borderWidth: 2, shadow: 'none' },
      buttons: { style: 'solid', shape: 'square', size: 'md', hover: 'lift', uppercase: true, shadow: false },
      background: { type: 'pattern', color: '#EFEEEA', pattern: { id: 'grid', color: '#1E1E1E', opacity: 7, scale: 1 } },
      header: { style: 'dark', logoPosition: 'left', menuPosition: 'right' },
      footer: { style: 'dark' },
      cards: { style: 'compact', imagePosition: 'top', imageRatio: 'landscape', hover: 'lift', align: 'left' },
      badges: { style: 'solid', shape: 'square' },
    },
  },
];

/** Aplica un preset sobre el tema actual conservando las preferencias de contenido. */
export function applyPreset(theme: ThemeConfig, preset: ThemePreset): ThemeConfig {
  // Al cambiar de preset se resetea el fondo completo (evita mezclar patrón de uno con imagen de otro).
  const base: ThemeConfig = { ...theme, background: themeSchema.shape.background.parse({ type: 'color', color: '#FFFFFF' }) };
  const merged = deepMerge(base as unknown as PlainObject, { ...(preset.theme as PlainObject), preset: preset.id });
  return themeSchema.parse(merged);
}

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}
