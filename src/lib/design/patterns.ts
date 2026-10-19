import { msg } from '@/i18n/translate';

/**
 * Patrones y texturas descritos como geometría. La misma descripción se
 * convierte en SVG (web, como data URI) y en figuras de react-pdf (PDF):
 * así los fondos se ven igual en ambos destinos.
 * Para agregar un patrón basta con agregar una entrada aquí.
 */
export type PatternShape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number }
  | { kind: 'path'; d: string; width: number };

export type PatternDef = { label: string; tile: number; shapes: PatternShape[]; texture?: boolean };

export const PATTERN_IDS = ['dots', 'grid', 'lines', 'diagonal', 'cross', 'checks', 'waves', 'zigzag', 'linen', 'paper'] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

/** Pseudo-aleatorio determinista (misma textura en web y PDF). */
function specks(count: number, size: number, seed: number): PatternShape[] {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => ({ kind: 'circle' as const, cx: rand() * size, cy: rand() * size, r: 0.35 + rand() * 0.55 }));
}

export const PATTERNS: Record<PatternId, PatternDef> = {
  dots: { label: msg('Puntos'), tile: 20, shapes: [{ kind: 'circle', cx: 10, cy: 10, r: 1.6 }] },
  grid: {
    label: msg('Cuadrícula'),
    tile: 24,
    shapes: [
      { kind: 'line', x1: 0, y1: 0, x2: 24, y2: 0, width: 1 },
      { kind: 'line', x1: 0, y1: 0, x2: 0, y2: 24, width: 1 },
    ],
  },
  lines: { label: msg('Líneas'), tile: 14, shapes: [{ kind: 'line', x1: 0, y1: 7, x2: 14, y2: 7, width: 1 }] },
  diagonal: {
    label: msg('Diagonal'),
    tile: 16,
    shapes: [
      { kind: 'line', x1: 0, y1: 16, x2: 16, y2: 0, width: 1.2 },
      { kind: 'line', x1: -4, y1: 4, x2: 4, y2: -4, width: 1.2 },
      { kind: 'line', x1: 12, y1: 20, x2: 20, y2: 12, width: 1.2 },
    ],
  },
  cross: {
    label: msg('Cruces'),
    tile: 28,
    shapes: [
      { kind: 'line', x1: 10, y1: 14, x2: 18, y2: 14, width: 1.4 },
      { kind: 'line', x1: 14, y1: 10, x2: 14, y2: 18, width: 1.4 },
    ],
  },
  checks: {
    label: msg('Cuadros'),
    tile: 32,
    shapes: [
      { kind: 'rect', x: 0, y: 0, w: 16, h: 16 },
      { kind: 'rect', x: 16, y: 16, w: 16, h: 16 },
    ],
  },
  waves: { label: msg('Ondas'), tile: 40, shapes: [{ kind: 'path', d: 'M0 20 Q 10 10 20 20 T 40 20', width: 1.3 }] },
  zigzag: { label: msg('Zigzag'), tile: 24, shapes: [{ kind: 'path', d: 'M0 16 L6 8 L12 16 L18 8 L24 16', width: 1.3 }] },
  linen: {
    label: msg('Lino'),
    tile: 6,
    texture: true,
    shapes: [
      { kind: 'line', x1: 0, y1: 1.5, x2: 6, y2: 1.5, width: 0.6 },
      { kind: 'line', x1: 1.5, y1: 0, x2: 1.5, y2: 6, width: 0.6 },
    ],
  },
  paper: { label: msg('Papel'), tile: 60, texture: true, shapes: specks(26, 60, 7) },
};

/** SVG de una baldosa del patrón (web). */
export function patternSvg(id: PatternId, color: string, opacity: number, scale = 1): { svg: string; size: number } {
  const def = PATTERNS[id];
  const size = def.tile * scale;
  const body = def.shapes
    .map((shape) => {
      switch (shape.kind) {
        case 'circle':
          return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${color}"/>`;
        case 'rect':
          return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${color}"/>`;
        case 'line':
          return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${color}" stroke-width="${shape.width}"/>`;
        case 'path':
          return `<path d="${shape.d}" fill="none" stroke="${color}" stroke-width="${shape.width}"/>`;
      }
    })
    .join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${def.tile} ${def.tile}"><g opacity="${opacity}">${body}</g></svg>`,
    size,
  };
}
