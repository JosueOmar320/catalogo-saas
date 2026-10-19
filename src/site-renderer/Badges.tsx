import type { CSSProperties } from 'react';
import type { Translator } from '@/i18n/translate';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { readableOn } from '@/lib/design/color';
import type { ThemeConfig } from '@/lib/design/theme';
import { resolveBadges } from '@/lib/site/resolve';
import { defaultText } from './default-texts';
import styles from './site.module.css';

/** `inline`: dentro del flujo del texto (listas, zigzag) en lugar de sobre la imagen. `t`: idioma del sitio para las etiquetas de fábrica. */
export function Badges({ item, theme, t, inline }: { item: CatalogItemView; theme: ThemeConfig; t: Translator; inline?: boolean }) {
  const badges = resolveBadges(item, theme, { lowStock: true });
  if (badges.length === 0) return null;
  const { style, shape, position } = theme.badges;
  return (
    <div className={styles.badges} data-position={inline ? 'inline' : position}>
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={styles.badge}
          data-style={style}
          data-shape={shape}
          style={{ '--badge': badge.color, '--badge-text': readableOn(badge.color) } as CSSProperties}
        >
          {badge.key === 'lowStock' ? t('¡Quedan {count}!', badge.params) : defaultText(badge.label, t)}
        </span>
      ))}
    </div>
  );
}
