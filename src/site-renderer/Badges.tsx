import type { CSSProperties } from 'react';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { readableOn } from '@/lib/design/color';
import type { ThemeConfig } from '@/lib/design/theme';
import { resolveBadges } from '@/lib/site/resolve';
import styles from './site.module.css';

/** `inline`: dentro del flujo del texto (listas, zigzag) en lugar de sobre la imagen. */
export function Badges({ item, theme, inline }: { item: CatalogItemView; theme: ThemeConfig; inline?: boolean }) {
  const badges = resolveBadges(item, theme);
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
          {badge.label}
        </span>
      ))}
    </div>
  );
}
