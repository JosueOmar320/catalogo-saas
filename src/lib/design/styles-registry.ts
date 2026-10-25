import { msg } from '@/i18n/translate';

/**
 * Metadatos de estilos visuales seleccionables. La implementación visual vive
 * en el renderer web (CSS por clase) y en el PDF. Agregar un estilo = agregar
 * el id aquí + su CSS/variante (TypeScript exige completarlos).
 */
export const HEADER_STYLES = ['minimal', 'classic', 'centered', 'modern', 'transparent', 'dark', 'elegant', 'floating', 'glass', 'brand'] as const;
export type HeaderStyleId = (typeof HEADER_STYLES)[number];

export const HEADER_STYLE_META: Record<HeaderStyleId, { label: string; description: string }> = {
  minimal: { label: msg('Minimal'), description: msg('Sin fondo ni bordes, sólo lo esencial.') },
  classic: { label: msg('Clásico'), description: msg('Barra sólida con línea inferior.') },
  centered: { label: msg('Centrado'), description: msg('Logo al centro y menú debajo.') },
  modern: { label: msg('Moderno'), description: msg('Barra flotante con esquinas y sombra.') },
  transparent: { label: msg('Transparente'), description: msg('Sobre el hero, con texto claro.') },
  dark: { label: msg('Oscuro'), description: msg('Barra oscura con texto claro.') },
  elegant: { label: msg('Elegante'), description: msg('Logo centrado, menú en mayúsculas y doble línea.') },
  floating: { label: msg('Cápsula'), description: msg('Barra redondeada que flota sobre el sitio.') },
  glass: { label: msg('Cristal'), description: msg('Translúcida con desenfoque: se ve el sitio detrás.') },
  brand: { label: msg('De marca'), description: msg('Con el color principal de tu marca y texto claro.') },
};

export const CARD_STYLES = ['minimal', 'classic', 'modern', 'imageFocus', 'compact', 'elegant', 'borderless'] as const;
export type CardStyleId = (typeof CARD_STYLES)[number];

export const CARD_STYLE_META: Record<CardStyleId, { label: string; description: string }> = {
  minimal: { label: msg('Minimal'), description: msg('Sin borde, texto sobrio.') },
  classic: { label: msg('Clásica'), description: msg('Borde fino y fondo de tarjeta.') },
  modern: { label: msg('Moderna'), description: msg('Sombra suave y esquinas amplias.') },
  imageFocus: { label: msg('Imagen protagonista'), description: msg('Foto grande, texto compacto.') },
  compact: { label: msg('Compacta'), description: msg('Menos espacio, ideal para muchos ítems.') },
  elegant: { label: msg('Elegante'), description: msg('Centrada, tipografía de títulos y línea fina.') },
  borderless: { label: msg('Sin bordes'), description: msg('Imagen con esquinas y texto libre.') },
};

export const FOOTER_STYLES = ['simple', 'columns', 'centered', 'dark'] as const;
export type FooterStyleId = (typeof FOOTER_STYLES)[number];

export const FOOTER_STYLE_META: Record<FooterStyleId, { label: string }> = {
  simple: { label: msg('Simple') },
  columns: { label: msg('Columnas') },
  centered: { label: msg('Centrado') },
  dark: { label: msg('Oscuro') },
};

export const BADGE_KEYS = ['new', 'featured', 'sale', 'popular', 'soldOut'] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];
