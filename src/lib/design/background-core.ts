import { isDark, mix } from './color';
import { patternSvg, type PatternId } from './patterns';
import type { Background } from './background';

/**
 * Lógica de fondos SIN zod: la usan los componentes del sitio público, así el
 * esquema (y zod) no viaja al navegador. `background.ts` la re-exporta.
 */

/** Igual a `backgroundSchema.parse({})` (lo verifica un test). */
export const INHERIT_BACKGROUND: Background = {
  type: 'inherit',
  color: '#FFFFFF',
  gradient: { kind: 'linear', angle: 135, from: '#FFFFFF', to: '#E8E8E8' },
  image: { path: null, position: 'center', size: 'cover', repeat: false, opacity: 100, fixed: false },
  video: { url: '' },
  pattern: { id: 'dots', color: '#000000', opacity: 12, scale: 1 },
  overlay: { color: '#000000', opacity: 0 },
};

/** Aplica la cascada sección > página > global. */
export function resolveBackground(...levels: (Background | null | undefined)[]): Background {
  return levels.find((bg) => bg && bg.type !== 'inherit') ?? INHERIT_BACKGROUND;
}

/**
 * Color "promedio" aproximado del fondo, para elegir texto claro u oscuro.
 * Devuelve null si no se puede saber (imagen sin overlay).
 */
export function backgroundTone(bg: Background): string | null {
  const overlay = bg.overlay.opacity / 100;
  let base: string | null;
  switch (bg.type) {
    case 'color':
    case 'pattern':
      base = bg.color;
      break;
    case 'gradient':
      base = mix(bg.gradient.from, bg.gradient.to, 0.5);
      break;
    case 'image':
    case 'video':
      base = overlay >= 0.35 ? bg.overlay.color : null;
      break;
    default:
      base = null;
  }
  if (base && overlay > 0) return mix(bg.overlay.color, base, overlay);
  return base;
}

export function isDarkBackground(bg: Background): boolean | null {
  const tone = backgroundTone(bg);
  return tone ? isDark(tone) : null;
}

export function gradientCss(bg: Background): string {
  const { kind, angle, from, to } = bg.gradient;
  return kind === 'radial' ? `radial-gradient(circle at center, ${from}, ${to})` : `linear-gradient(${angle}deg, ${from}, ${to})`;
}

/** Imagen de fondo del patrón como data URI + tamaño de baldosa (web). */
export function patternCss(id: PatternId, color: string, opacity: number, scale: number) {
  const { svg, size } = patternSvg(id, color, opacity / 100, scale);
  return { image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, size: `${size}px ${size}px` };
}
