import type { ThemeConfig } from '@/lib/design/theme';
import { resolveLink, type LinkContext } from '@/lib/site/links';
import type { ButtonConfig } from '@/lib/site/section-schemas';
import type { RenderEnv } from './env';
import { Icon } from './Icon';
import styles from './site.module.css';

/** Variante visual real según el estilo global de botones del tema. */
export function buttonVariant(theme: ThemeConfig, variant: 'primary' | 'secondary') {
  const primary = theme.buttons.style;
  if (variant === 'primary') return primary;
  return primary === 'solid' ? 'outline' : primary === 'outline' ? 'ghost' : 'outline';
}

type Props = {
  button: ButtonConfig;
  theme: ThemeConfig;
  links: LinkContext;
  env: RenderEnv;
  small?: boolean;
};

/** Botón configurado por el usuario. Se omite si no tiene texto o destino válido (salvo en preview). */
export function SiteButton({ button, theme, links, env, small }: Props) {
  if (!button.label.trim()) return null;
  const target = resolveLink(button.link, links);
  if (!target && env.mode === 'public') return null;
  const external = target?.external ?? false;
  return (
    <a
      href={target?.href ?? '#'}
      className={`${styles.btn} ${small ? styles.btnSmall : ''}`}
      data-variant={buttonVariant(theme, button.variant)}
      data-hover={theme.buttons.hover}
      data-page-id={target?.pageId}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {button.icon && <Icon id={button.icon} size={small ? 15 : 17} />}
      {button.label}
    </a>
  );
}
