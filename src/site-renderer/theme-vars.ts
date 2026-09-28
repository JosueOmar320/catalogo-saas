import type { CSSProperties } from 'react';
import type { ThemeConfig } from '@/lib/design/theme';
import { resolveTokens } from '@/lib/design/tokens';
import { FONT_FAMILIES } from './fonts';

const HEADER_HEIGHT = { compact: 60, normal: 76, tall: 96 } as const;
const RATIOS = { square: '1 / 1', portrait: '4 / 5', landscape: '4 / 3', wide: '16 / 9' } as const;

/**
 * Tema → variables CSS. Todo el estilo del sitio depende de estas variables:
 * cambiar el tema en el editor sólo actualiza el `style` de la raíz.
 * Los colores ya vienen validados como hex (sin inyección de CSS).
 */
export function themeToVars(theme: ThemeConfig): CSSProperties {
  const t = resolveTokens(theme);
  const c = t.colors;
  const vars: Record<string, string | number> = {
    '--c-primary': c.primary,
    '--c-secondary': c.secondary,
    '--c-accent': c.accent,
    '--c-bg': c.background,
    '--c-surface': c.surface,
    '--c-text': c.text,
    '--c-muted': c.mutedText,
    '--c-border': c.border,
    '--c-heading': c.heading,
    '--c-button': c.button,
    '--c-button-text': c.buttonText,
    '--c-price': c.price,
    '--c-primary-soft': c.primarySoft,
    '--c-accent-soft': c.accentSoft,
    '--c-on-primary': c.onPrimary,
    '--c-on-accent': c.onAccent,
    // Copias "de tema": las tarjetas con superficie propia las restauran
    // aunque la sección tenga texto claro sobre fondo oscuro.
    '--t-text': c.text,
    '--t-heading': c.heading,
    '--t-muted': c.mutedText,
    '--t-border': c.border,
    '--t-price': c.price,
    '--f-body': FONT_FAMILIES[t.fonts.body],
    '--f-heading': FONT_FAMILIES[t.fonts.heading],
    '--f-price': FONT_FAMILIES[t.fonts.price],
    '--fs-base': `${t.type.base}px`,
    '--fs-small': `${t.type.small}px`,
    '--fs-h1': `${t.type.h1}px`,
    '--fs-h2': `${t.type.h2}px`,
    '--fs-h3': `${t.type.h3}px`,
    '--lh': t.type.lineHeight,
    '--hw': t.type.headingWeight,
    '--hls': `${t.type.headingLetterSpacing}em`,
    '--htt': t.type.headingCase,
    '--sp-section': `${t.space.section}px`,
    '--sp-section-m': `${t.space.sectionMobile}px`,
    '--gap': `${t.space.gap}px`,
    '--maxw': t.space.maxWidth ? `${t.space.maxWidth}px` : '100%',
    '--sp-title': `${t.space.title}px`,
    '--radius': `${t.shape.radius}px`,
    '--bw': `${t.shape.borderWidth}px`,
    '--shadow': t.shape.shadow,
    '--btn-py': `${t.button.padY}px`,
    '--btn-px': `${t.button.padX}px`,
    '--btn-fs': `${t.button.font}px`,
    '--btn-radius': `${t.button.radius}px`,
    '--btn-shadow': t.button.shadow,
    '--btn-tt': t.button.uppercase ? 'uppercase' : 'none',
    '--btn-ls': t.button.uppercase ? '0.06em' : '0',
    '--header-h': `${HEADER_HEIGHT[theme.header.height]}px`,
    '--card-ratio': RATIOS[theme.cards.imageRatio],
  };
  return vars as CSSProperties;
}

export const CARD_RATIOS = RATIOS;
