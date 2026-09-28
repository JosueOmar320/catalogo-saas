/**
 * Metadatos de estilos visuales seleccionables. La implementación visual vive
 * en el renderer web (CSS por clase) y en el PDF. Agregar un estilo = agregar
 * el id aquí + su CSS/variante (TypeScript exige completarlos).
 */
export const HEADER_STYLES = ['minimal', 'classic', 'centered', 'modern', 'transparent', 'dark', 'elegant'] as const;
export type HeaderStyleId = (typeof HEADER_STYLES)[number];

export const HEADER_STYLE_META: Record<HeaderStyleId, { label: string; description: string }> = {
  minimal: { label: 'Minimal', description: 'Sin fondo ni bordes, sólo lo esencial.' },
  classic: { label: 'Clásico', description: 'Barra sólida con línea inferior.' },
  centered: { label: 'Centrado', description: 'Logo al centro y menú debajo.' },
  modern: { label: 'Moderno', description: 'Barra flotante con esquinas y sombra.' },
  transparent: { label: 'Transparente', description: 'Sobre el hero, con texto claro.' },
  dark: { label: 'Oscuro', description: 'Barra oscura con texto claro.' },
  elegant: { label: 'Elegante', description: 'Logo centrado, menú en mayúsculas y doble línea.' },
};

export const CARD_STYLES = ['minimal', 'classic', 'modern', 'imageFocus', 'compact', 'elegant', 'borderless'] as const;
export type CardStyleId = (typeof CARD_STYLES)[number];

export const CARD_STYLE_META: Record<CardStyleId, { label: string; description: string }> = {
  minimal: { label: 'Minimal', description: 'Sin borde, texto sobrio.' },
  classic: { label: 'Clásica', description: 'Borde fino y fondo de tarjeta.' },
  modern: { label: 'Moderna', description: 'Sombra suave y esquinas amplias.' },
  imageFocus: { label: 'Imagen protagonista', description: 'Foto grande, texto compacto.' },
  compact: { label: 'Compacta', description: 'Menos espacio, ideal para muchos ítems.' },
  elegant: { label: 'Elegante', description: 'Centrada, tipografía de títulos y línea fina.' },
  borderless: { label: 'Sin bordes', description: 'Imagen con esquinas y texto libre.' },
};

export const FOOTER_STYLES = ['simple', 'columns', 'centered', 'dark'] as const;
export type FooterStyleId = (typeof FOOTER_STYLES)[number];

export const FOOTER_STYLE_META: Record<FooterStyleId, { label: string }> = {
  simple: { label: 'Simple' },
  columns: { label: 'Columnas' },
  centered: { label: 'Centrado' },
  dark: { label: 'Oscuro' },
};

export const BADGE_KEYS = ['new', 'featured', 'sale', 'popular', 'soldOut'] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];
