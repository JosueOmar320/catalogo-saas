import { alpha, mix, readableOn } from './color';
import { TYPE_ROLES, type ThemeConfig, type TypeRole } from './theme';

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

export type ResolvedRole = { size: number; mobileSize: number; weight: number; lineHeight: number; letterSpacing: number; transform: string; font: 'heading' | 'body' };

/** Valores finales por rol: lo ajustado por el usuario o lo derivado de la escala. */
function resolveRoles(theme: ThemeConfig, sizes: Record<TypeRole, number>, buttonUppercase: boolean): Record<TypeRole, ResolvedRole> {
  const t = theme.typography;
  const headingWeight = Number(t.headingWeight);
  const defaults: Record<TypeRole, Omit<ResolvedRole, 'size' | 'mobileSize'> & { mobile: number }> = {
    h1: { weight: headingWeight, lineHeight: 1.05, letterSpacing: t.headingLetterSpacing, transform: t.headingCase, font: 'heading', mobile: 0.62 },
    h2: { weight: headingWeight, lineHeight: 1.15, letterSpacing: t.headingLetterSpacing, transform: t.headingCase, font: 'heading', mobile: 0.75 },
    h3: { weight: headingWeight, lineHeight: 1.2, letterSpacing: t.headingLetterSpacing, transform: t.headingCase, font: 'heading', mobile: 0.92 },
    body: { weight: 400, lineHeight: t.lineHeight, letterSpacing: 0, transform: 'none', font: 'body', mobile: 1 },
    small: { weight: 400, lineHeight: 1.45, letterSpacing: 0, transform: 'none', font: 'body', mobile: 1 },
    label: { weight: 600, lineHeight: 1.3, letterSpacing: 0.08, transform: 'uppercase', font: 'body', mobile: 1 },
    button: { weight: 600, lineHeight: 1.2, letterSpacing: buttonUppercase ? 0.06 : 0, transform: buttonUppercase ? 'uppercase' : 'none', font: 'body', mobile: 1 },
  };
  return Object.fromEntries(
    TYPE_ROLES.map((role) => {
      const custom = t.roles[role];
      const base = defaults[role];
      const size = custom.size || sizes[role];
      return [
        role,
        {
          size,
          mobileSize: custom.mobileSize || Math.round(size * base.mobile),
          weight: custom.weight === 'auto' ? base.weight : Number(custom.weight),
          lineHeight: custom.lineHeight || base.lineHeight,
          letterSpacing: custom.letterSpacing ?? base.letterSpacing,
          transform: custom.transform === 'auto' ? base.transform : custom.transform,
          font: custom.font === 'auto' ? base.font : custom.font,
        },
      ];
    }),
  ) as Record<TypeRole, ResolvedRole>;
}

export function resolveTokens(theme: ThemeConfig) {
  const { colors, typography, spacing, shape, buttons } = theme;
  const ratio = HEADING_RATIO[typography.headingScale];
  const base = typography.baseSize;
  const buttonRadius = buttons.shape === 'pill' ? 999 : buttons.shape === 'square' ? 0 : Math.max(4, shape.radius);
  const scaleSizes: Record<TypeRole, number> = {
    h1: Math.round(base * ratio ** 3.6),
    h2: Math.round(base * ratio ** 2.4),
    h3: Math.round(base * ratio),
    body: base,
    small: Math.round(base * 0.875),
    label: Math.round(base * 0.8),
    button: BUTTON_SIZE[buttons.size].font,
  };
  const roles = resolveRoles(theme, scaleSizes, buttons.uppercase);

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
    roles,
    type: {
      base: roles.body.size,
      small: roles.small.size,
      h3: roles.h3.size,
      h2: roles.h2.size,
      h1: roles.h1.size,
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
