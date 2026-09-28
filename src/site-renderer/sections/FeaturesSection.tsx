import { Icon } from '../Icon';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function FeaturesSection({ section, site, env }: SectionProps<'features'>) {
  const { content } = section;
  if (content.items.length === 0 && env.mode === 'public') return null;
  const center = content.alignment === 'center';
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
      <Placeholder show={content.items.length === 0}>Agrega beneficios con ícono desde el editor.</Placeholder>
      <div
        className={`${styles.features} ${content.layout === 'inline' ? '' : styles.grid}`}
        data-layout={content.layout}
        data-align={content.alignment}
        style={content.layout === 'inline' ? undefined : gridVars(content.layout === 'list' ? { ...content.columns, desktop: Math.min(content.columns.desktop, 2) } : content.columns)}
      >
        {content.items.map((item) => (
          <div key={item.id} className={styles.feature}>
            <span className={styles.featureIcon} data-style={content.iconStyle}>
              <Icon id={item.icon} size={content.iconStyle === 'plain' ? 30 : 24} />
            </span>
            <div>
              {item.title && <h3 className={styles.featureTitle}>{item.title}</h3>}
              {item.text && content.layout !== 'inline' && <p className={styles.featureText}>{item.text}</p>}
            </div>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}
