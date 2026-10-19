import { z } from 'zod';
import { PATTERN_IDS } from './patterns';
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
        path: f(z.string().max(1000).nullable(), null),
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

export { INHERIT_BACKGROUND, resolveBackground, backgroundTone, isDarkBackground, gradientCss, patternCss } from './background-core';
