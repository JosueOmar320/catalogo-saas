import { contrastRatio, mix, readableOn } from '@/lib/design/color';
import { resolveBackground, type Background } from '@/lib/design/background';
import type { ThemeConfig } from '@/lib/design/theme';
import { resolveTokens } from '@/lib/design/tokens';
import type { PdfSettings } from '@/lib/pdf/settings';

/** Tamaños de página en puntos (1 pt = 1/72 in). */
const PAPER = { A4: [595.28, 841.89], LETTER: [612, 792], A5: [419.53, 595.28] } as const;
const MARGINS = { small: 24, medium: 36, large: 56 } as const;
const MM = 2.835;

export type PdfFonts = { heading: string; body: string; price: string };

/**
 * Tokens del PDF derivados del MISMO tema del sitio (tokens.ts): colores,
 * escala tipográfica, radios. Sólo cambia la unidad (px → pt).
 */
export function pdfTokens(theme: ThemeConfig, settings: PdfSettings, fonts: PdfFonts) {
  const t = resolveTokens(theme);
  const [w, h] = PAPER[settings.paperSize];
  const landscape = settings.orientation === 'landscape';
  const pageWidth = landscape ? h : w;
  const pageHeight = landscape ? w : h;
  const margin = settings.margins === 'custom' ? settings.customMargin * MM : MARGINS[settings.margins];
  const small = settings.paperSize === 'A5';
  const base = Math.min(11, Math.max(8.5, t.type.base * (small ? 0.54 : 0.6)));
  const ratio = t.type.h3 / t.type.base;

  // Paleta: la del tema, o "ahorro de tinta" (papel blanco y colores legibles).
  let colors = { ...t.colors };
  if (settings.inkSaver) {
    const ink = contrastRatio(colors.text, '#FFFFFF') >= 4.5 ? colors.text : '#1A1A1A';
    const readable = (c: string) => (contrastRatio(c, '#FFFFFF') >= 3 ? c : ink);
    colors = {
      ...colors,
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: ink,
      heading: contrastRatio(colors.heading, '#FFFFFF') >= 4.5 ? colors.heading : ink,
      mutedText: '#6B6B6B',
      border: '#E2E2E2',
      primary: readable(colors.primary),
      accent: readable(colors.accent),
      price: readable(colors.price),
      button: readable(colors.button),
      buttonText: readableOn(readable(colors.button)),
    };
  }

  const pageBackground: Background = settings.inkSaver
    ? resolveBackground(null)
    : resolveBackground(settings.background, theme.background);
  const paper = pageBackground.type === 'color' || pageBackground.type === 'pattern' ? pageBackground.color : colors.background;

  return {
    fonts,
    pageWidth,
    pageHeight,
    margin,
    contentWidth: pageWidth - margin * 2,
    headerSpace: settings.header.enabled ? 30 : 0,
    footerSpace: settings.footer.enabled ? 26 : 0,
    colors: {
      ...colors,
      paper,
      soft: mix(colors.primary, paper, 0.08),
      onPrimary: readableOn(colors.primary),
      onAccent: readableOn(colors.accent),
    },
    size: { base, small: base * 0.85, tiny: base * 0.75, h3: base * ratio, h2: base * ratio ** 2.2, h1: base * ratio ** 3.4 },
    headingWeight: Number(theme.typography.headingWeight) >= 600 ? 700 : 400,
    headingUpper: theme.typography.headingCase === 'uppercase',
    letterSpacing: theme.typography.headingLetterSpacing * base,
    radius: Math.min(theme.shape.radius * 0.6, 12),
    borderWidth: Math.max(0.5, theme.shape.borderWidth * 0.6),
    pageBackground,
  };
}

export type PdfTokens = ReturnType<typeof pdfTokens>;
