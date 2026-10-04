import { contrastRatio, isDark, mix } from '@/lib/design/color';
import type { ThemeConfig } from '@/lib/design/theme';
import type { Section } from './section-schemas';

/**
 * Dirección de arte automática: le da RITMO visual a una página sin tocar su
 * contenido. Alterna fondos (suave / color de marca), oscurece las imágenes
 * de fondo para que el texto se lea, y en "bold" agrega divisores y parallax.
 *
 * Respeta las decisiones del usuario: sólo cambia secciones sin fondo propio
 * (o con un fondo que puso esta misma función).
 */

export const ART_INTENSITIES = ['subtle', 'balanced', 'bold'] as const;
export type ArtIntensity = (typeof ART_INTENSITIES)[number];

export function artPalette(theme: ThemeConfig) {
  const { primary, background, accent } = theme.colors;
  const darkSite = isDark(background);
  // Banda suave: un toque del color principal sobre el fondo del sitio.
  const soft = mix(primary, background, darkSite ? 0.12 : 0.06);
  // Banda de marca: el principal si contrasta con texto blanco; si no, una versión más oscura.
  const brand = contrastRatio(primary, '#FFFFFF') >= 3 ? primary : mix(primary, '#000000', 0.45);
  const brandTo = contrastRatio(accent, '#FFFFFF') >= 3 && accent.toLowerCase() !== primary.toLowerCase() ? accent : mix(brand, '#000000', 0.3);
  return { soft, brand, brandTo };
}

type Tone = 'none' | 'soft' | 'brand';

/** Secciones que funcionan como "banda" de color (cifras, llamados a la acción). */
function wantsBrand(section: Section): boolean {
  if (section.type === 'stats' || section.type === 'banner') return true;
  if (section.type === 'columns') {
    const c = section.content;
    const blocks = c.columns.flatMap((col) => col.blocks);
    return (c.layout === '1' && blocks.some((b) => b.kind === 'buttons')) || blocks.every((b) => b.kind === 'stat');
  }
  return false;
}

const SOFT_FRIENDLY = new Set(['features', 'testimonials', 'faq', 'pricing', 'team', 'logos', 'products', 'services', 'categories', 'columns', 'text', 'gallery']);

export function artDirect(sections: Section[], theme: ThemeConfig, intensity: ArtIntensity = 'balanced'): Section[] {
  const { soft, brand, brandTo } = artPalette(theme);
  const ours = (s: Section) => {
    const bg = s.style.background;
    if (bg.type === 'inherit') return true;
    if (bg.type === 'color') return [soft, brand].map((c) => c.toLowerCase()).includes(bg.color.toLowerCase());
    return bg.type === 'gradient' && bg.gradient.from.toLowerCase() === brand.toLowerCase();
  };

  let previous: Tone = 'none';
  let alternate = false;
  return sections.map((section, index) => {
    const style = { ...section.style };
    const bg = style.background;

    // Fondos con imagen o video: overlay para que el texto se lea siempre.
    if ((bg.type === 'image' && bg.image.path) || bg.type === 'video') {
      // Color base oscuro: mientras la foto carga no se ve un gris lavado.
      const color = bg.color.toUpperCase() === '#FFFFFF' ? '#111111' : bg.color;
      const next = { ...section, style: { ...style, background: { ...bg, color, overlay: bg.overlay.opacity > 0 ? bg.overlay : { color: '#000000', opacity: section.type === 'hero' ? 50 : 55 } }, textColor: style.textColor === 'auto' ? ('light' as const) : style.textColor } };
      if (intensity === 'bold' && bg.type === 'image' && section.type !== 'hero') next.style.background = { ...next.style.background, image: { ...bg.image, fixed: true } };
      previous = 'brand';
      return next;
    }
    if (section.type === 'spacer' || !ours(section)) {
      previous = bg.type === 'inherit' ? 'none' : 'brand';
      return section;
    }

    // Portada sin imagen: degradado de marca.
    if (section.type === 'hero' && index === 0) {
      previous = 'brand';
      return { ...section, style: { ...style, background: { ...bg, type: 'gradient' as const, gradient: { ...bg.gradient, from: brand, to: brandTo, angle: 135 } }, textColor: 'light' as const } };
    }

    let tone: Tone = 'none';
    if (intensity !== 'subtle' && wantsBrand(section) && previous !== 'brand') tone = 'brand';
    else if (SOFT_FRIENDLY.has(section.type)) {
      tone = alternate && previous === 'none' ? 'soft' : 'none';
      if (intensity === 'subtle' && section.type !== 'testimonials' && section.type !== 'features') tone = 'none';
      alternate = !alternate;
    }

    const next: Section = { ...section, style: { ...style } };
    if (tone === 'brand') {
      next.style.background = intensity === 'bold' ? { ...bg, type: 'gradient', gradient: { ...bg.gradient, from: brand, to: brandTo, angle: 120 } } : { ...bg, type: 'color', color: brand };
      next.style.textColor = 'light';
      if (intensity === 'bold' && previous === 'none') next.style.dividerTop = { ...next.style.dividerTop, shape: 'wave', color: '', height: 'md', flip: false };
    } else if (tone === 'soft') {
      next.style.background = { ...bg, type: 'color', color: soft };
      next.style.textColor = 'auto';
      if (intensity === 'bold' && previous === 'none') next.style.dividerTop = { ...next.style.dividerTop, shape: 'curve', color: '', height: 'sm', flip: false };
    } else {
      next.style.background = { ...bg, type: 'inherit' };
      if (style.textColor === 'light' && ours(section)) next.style.textColor = 'auto';
    }
    previous = tone;
    return next;
  });
}
