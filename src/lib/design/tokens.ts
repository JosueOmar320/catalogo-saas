import { alpha, mix, readableOn } from './color';
import type { ThemeConfig } from './theme';

/**
 * Valores concretos derivados del tema. Es la única traducción de "opciones"
 * a "medidas": la web la convierte en variables CSS y el PDF en estilos.
 */
export type DesignTokens = ReturnType<typeof resolveTokens>;

const HEADING_RATIO = { sm: 1.2, md: 1.28, lg: 1.36, xl: 1.45 } as const;
const SECTION_PADDING = { compact: 40, normal: 64, relaxed: 88, spacious: 120 } as const;
const GAP = { tight: 12, normal: 20, loose: 32 } as const;
const MAX_WIDTH = { narrow: 960, normal: 1180, wide: 1360, full: null } as const;
const TITLE_SPACING = { sm: 12, md: 20, lg: 32 } as const;
const BUTTON_SIZE = { sm: { padY: 7, padX: 14, font: 14 }, md: { padY: 10, padX: 18, font: 15 }, lg: { padY: 13, padX: 24, font: 16 } } as const;
const SHADOWS = {
  none: 'none',
  soft: '0 1px 2px rgba(16,24,40,.05), 0 2px 8px rgba(16,24,40,.06)',
  medium: '0 4px 12px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.06)',
  strong: '0 12px 32px rgba(16,24,40,.14), 0 4px 8px rgba(16,24,40,.08)',
} as const;

export function resolveTokens(theme: ThemeConfig) {
  const { colors, typography, spacing, shape, buttons } = theme;
  const ratio = HEADING_RATIO[typography.headingScale];
  const base = typography.baseSize;
  const buttonRadius = buttons.shape === 'pill' ? 999 : buttons.shape === 'square' ? 0 : Math.max(4, shape.radius);

  return {
    colors: {
      ...colors,
      primarySoft: mix(colors.primary, colors.background, 0.1),
      accentSoft: mix(colors.accent, colors.background, 0.12),
      onPrimary: readableOn(colors.primary),
      onAccent: readableOn(colors.accent),
      overlaySoft: alpha(colors.text, 0.04),
    },
    fonts: { body: typography.bodyFont, heading: typography.headingFont, price: typography.priceFont },
    type: {
      base,
      small: Math.round(base * 0.875),
      h3: Math.round(base * ratio),
      h2: Math.round(base * ratio ** 2.4),
      h1: Math.round(base * ratio ** 3.6),
      lineHeight: typography.lineHeight,
      headingWeight: Number(typography.headingWeight),
      headingLetterSpacing: typography.headingLetterSpacing,
      headingCase: typography.headingCase,
    },
    space: {
      section: SECTION_PADDING[spacing.sectionPadding],
      sectionMobile: Math.round(SECTION_PADDING[spacing.sectionPadding] * 0.62),
      gap: GAP[spacing.gap],
      maxWidth: MAX_WIDTH[spacing.maxWidth],
      title: TITLE_SPACING[spacing.titleSpacing],
    },
    shape: { radius: shape.radius, borderWidth: shape.borderWidth, shadow: SHADOWS[shape.shadow], shadowLevel: shape.shadow },
    button: {
      ...BUTTON_SIZE[buttons.size],
      radius: buttonRadius,
      style: buttons.style,
      shadow: buttons.shadow ? SHADOWS.soft : 'none',
      hover: buttons.hover,
      uppercase: buttons.uppercase,
    },
  };
}

export const SECTION_PADDING_PX = SECTION_PADDING;
