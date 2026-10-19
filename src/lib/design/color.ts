/** Utilidades de color compartidas por la web, el PDF y el editor. */
function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Mezcla `a` sobre `b` (weight = proporción de `a`, 0 a 1). */
export function mix(a: string, b: string, weight: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex([0, 1, 2].map((i) => ca[i] * weight + cb[i] * (1 - weight)) as [number, number, number]);
}

/** rgba() a partir de hex y opacidad 0-1. */
export function alpha(hex: string, opacity: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, opacity))})`;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export const MIN_READABLE_CONTRAST = 4.5;

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.22;
}

/** Color de texto legible (claro u oscuro) sobre un fondo. */
export function readableOn(background: string, light = '#FFFFFF', dark = '#111111'): string {
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
}
