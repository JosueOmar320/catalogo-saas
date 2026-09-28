import type { CSSProperties, ReactNode } from 'react';
import type { ThemeConfig } from '@/lib/design/theme';
import { resolveTextMode } from '@/lib/site/resolve';
import type { Section } from '@/lib/site/section-schemas';
import { BackgroundLayers } from './Background';
import styles from './site.module.css';

const PADDING = { none: '0px', sm: '24px', md: '48px', lg: '80px', xl: '120px' } as const;

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
  const container = style.width === 'full' ? styles.containerFull : style.width === 'wide' ? styles.containerWide : '';

  return (
    <section
      id={style.anchor || undefined}
      data-section-id={section.id}
      data-section-type={section.type}
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
      <div className={`${styles.container} ${container}`}>{children}</div>
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
