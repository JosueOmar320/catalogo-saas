import { z } from 'zod';
import { isDark, mix } from './color';
import { PATTERN_IDS, patternSvg, type PatternId } from './patterns';
import { fieldFactory, hexColor } from './schema-utils';

/**
 * Fondo reutilizable: global (tema), por página, por sección, header y PDF.
 * `type: 'inherit'` significa "usar el fondo del nivel superior".
 */
export const BACKGROUND_TYPES = ['inherit', 'color', 'gradient', 'image', 'pattern', 'video'] as const;
export const IMAGE_POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'] as const;
export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

export function buildBackgroundSchema(lenient: boolean, defaults: { type?: BackgroundType; color?: string } = {}) {
  const f = fieldFactory(lenient);
  return z.object({
    type: f(z.enum(BACKGROUND_TYPES), defaults.type ?? 'inherit'),
    color: f(hexColor, defaults.color ?? '#FFFFFF'),
    gradient: z
      .object({
        kind: f(z.enum(['linear', 'radial']), 'linear'),
        angle: f(z.number().int().min(0).max(360), 135),
        from: f(hexColor, '#FFFFFF'),
        to: f(hexColor, '#E8E8E8'),
      })
      .prefault({}),
    image: z
      .object({
        path: f(z.string().max(300).nullable(), null),
        position: f(z.enum(IMAGE_POSITIONS), 'center'),
        size: f(z.enum(['cover', 'contain', 'auto']), 'cover'),
        repeat: f(z.boolean(), false),
        opacity: f(z.number().min(0).max(100), 100),
        /** Imagen fija al hacer scroll (efecto parallax). */
        fixed: f(z.boolean(), false),
      })
      .prefault({}),
    /** Video de fondo (web). En el PDF se usa el color base. */
    video: z
      .object({
        url: f(z.union([z.literal(''), z.url({ protocol: /^https$/ }).max(500).regex(/\.(mp4|webm)(\?.*)?$/i, 'Usa un enlace directo .mp4 o .webm')]), ''),
      })
      .prefault({}),
    pattern: z
      .object({
        id: f(z.enum(PATTERN_IDS), 'dots'),
        color: f(hexColor, '#000000'),
        opacity: f(z.number().min(0).max(100), 12),
        scale: f(z.number().min(0.5).max(3), 1),
      })
      .prefault({}),
    overlay: z
      .object({
        color: f(hexColor, '#000000'),
        opacity: f(z.number().min(0).max(100), 0),
      })
      .prefault({}),
  });
}

export const backgroundSchema = buildBackgroundSchema(false);
export type Background = z.output<typeof backgroundSchema>;

export const INHERIT_BACKGROUND: Background = backgroundSchema.parse({});

export function colorBackground(color: string): Background {
  return backgroundSchema.parse({ type: 'color', color });
}

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
