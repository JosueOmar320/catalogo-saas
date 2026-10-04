import type { CSSProperties, ReactNode } from 'react';
import type { ThemeConfig } from '@/lib/design/theme';
import { resolveTextMode } from '@/lib/site/resolve';
import type { Section } from '@/lib/site/section-schemas';
import { BackgroundLayers } from './Background';
import styles from './site.module.css';

const PADDING = { none: '0px', sm: '24px', md: '48px', lg: '80px', xl: '120px' } as const;
const SHADOW = {
  none: '',
  soft: '0 1px 2px rgba(16,24,40,.05), 0 4px 14px rgba(16,24,40,.07)',
  medium: '0 6px 20px rgba(16,24,40,.1), 0 2px 6px rgba(16,24,40,.06)',
  strong: '0 18px 44px rgba(16,24,40,.16), 0 6px 12px rgba(16,24,40,.08)',
} as const;

type Divider = Section['style']['dividerTop'];

/** Formas (dibujadas para el borde inferior; arriba se reflejan). viewBox 1200×120. */
const DIVIDER_PATHS: Record<Exclude<Divider['shape'], 'none'>, string> = {
  wave: 'M0,64 C200,120 400,8 600,56 C800,104 1000,24 1200,60 L1200,120 L0,120 Z',
  curve: 'M0,0 Q600,150 1200,0 L1200,120 L0,120 Z',
  slant: 'M0,120 L1200,8 L1200,120 Z',
  zigzag: `M0,120 ${Array.from({ length: 13 }, (_, i) => `L${i * 100},${i % 2 ? 60 : 100}`).join(' ')} L1200,120 Z`,
  triangle: 'M0,120 L540,120 L600,40 L660,120 L1200,120 Z',
};

function SectionDivider({ divider, position }: { divider: Divider; position: 'top' | 'bottom' }) {
  if (divider.shape === 'none') return null;
  return (
    <div className={styles.divider} data-pos={position} data-height={divider.height} data-flip={divider.flip || undefined} aria-hidden>
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d={DIVIDER_PATHS[divider.shape]} fill={divider.color || 'var(--c-bg)'} />
      </svg>
    </div>
  );
}

type Props = {
  section: Section;
  theme: ThemeConfig;
  children: ReactNode;
  /** La sección dibuja su propio fondo (p. ej. banner en caja). */
  backgroundOnContent?: boolean;
  priority?: boolean;
  videoUrl?: string;
  className?: string;
};

/**
 * Envoltorio común de toda sección: fondo (con cascada sobre la página),
 * color de texto automático, espaciado, ancho y visibilidad por dispositivo.
 */
export function SectionFrame({ section, theme, children, backgroundOnContent, priority, videoUrl, className }: Props) {
  const { style } = section;
  const textMode = resolveTextMode(style.textColor, style.background, theme);
  const vars: Record<string, string> = {};
  if (style.paddingTop !== 'default') vars['--pt'] = PADDING[style.paddingTop];
  if (style.paddingBottom !== 'default') vars['--pb'] = PADDING[style.paddingBottom];
  if (style.border.width > 0) vars['--s-border'] = `${style.border.width}px solid ${style.border.color || 'var(--c-border)'}`;
  if (style.border.radius > 0) vars['--s-radius'] = `${style.border.radius}px`;
  if (style.shadow !== 'none') vars['--s-shadow'] = SHADOW[style.shadow];
  // Celular: padding propio (si se definió).
  const mobile = style.mobile;
  if (mobile.paddingTop !== 'inherit') vars['--pt-m'] = PADDING[mobile.paddingTop];
  if (mobile.paddingBottom !== 'inherit') vars['--pb-m'] = PADDING[mobile.paddingBottom];
  const container = style.width === 'full' ? styles.containerFull : style.width === 'wide' ? styles.containerWide : style.width === 'narrow' ? styles.containerNarrow : '';

  return (
    <section
      id={style.anchor || undefined}
      data-section-id={section.id}
      data-section-type={section.type}
      data-min-h={style.minHeight !== 'auto' ? style.minHeight : undefined}
      data-valign={style.minHeight !== 'auto' ? style.verticalAlign : undefined}
      data-align={style.textAlign !== 'inherit' ? style.textAlign : undefined}
      data-margin={style.marginTop !== 'none' ? style.marginTop : undefined}
      data-overlap={style.overlap !== 'none' ? style.overlap : undefined}
      data-boxed={style.boxed || undefined}
      data-mobile-pt={mobile.paddingTop !== 'inherit' || undefined}
      data-mobile-pb={mobile.paddingBottom !== 'inherit' || undefined}
      data-mobile-align={mobile.textAlign !== 'inherit' ? mobile.textAlign : undefined}
      data-decorated={style.border.width > 0 || style.border.radius > 0 || style.shadow !== 'none' || undefined}
      className={[
        styles.section,
        textMode === 'light' ? styles.onDark : textMode === 'dark' ? styles.onLight : '',
        style.hideOnMobile ? styles.hideMobile : '',
        style.hideOnDesktop ? styles.hideDesktop : '',
        className ?? '',
      ].join(' ')}
      style={vars as CSSProperties}
    >
      {!backgroundOnContent && <BackgroundLayers background={style.background} priority={priority} videoUrl={videoUrl} />}
      <SectionDivider divider={style.dividerTop} position="top" />
      <div className={`${styles.container} ${container}`}>{children}</div>
      <SectionDivider divider={style.dividerBottom} position="bottom" />
    </section>
  );
}

export function SectionHead({ eyebrow, title, subtitle, center, as = 'h2' }: { eyebrow?: string; title?: string; subtitle?: string; center?: boolean; as?: 'h1' | 'h2' }) {
  if (!eyebrow && !title && !subtitle) return null;
  const Heading = as;
  return (
    <div className={`${styles.sectionHead} ${center ? styles.sectionHeadCenter : ''}`}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      {title && <Heading className={as === 'h1' ? styles.h1 : styles.h2}>{title}</Heading>}
      {subtitle && <p className={styles.lead}>{subtitle}</p>}
    </div>
  );
}

export function Placeholder({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <div className={styles.placeholder}>{children}</div> : null;
}

export function gridVars(columns: { desktop: number; tablet: number; mobile: number }): CSSProperties {
  return { '--cols-d': columns.desktop, '--cols-t': columns.tablet, '--cols-m': columns.mobile } as CSSProperties;
}
