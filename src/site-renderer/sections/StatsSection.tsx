import { Icon } from '../Icon';
import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function StatsSection({ section, site, env }: SectionProps<'stats'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  if (content.items.length === 0 && env.mode === 'public') return null;
  const center = content.alignment === 'center';
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
      <Placeholder show={content.items.length === 0}>{t('Agrega cifras como «+500 clientes» o «10 años».')}</Placeholder>
      <div className={styles.stats} data-layout={content.layout} data-align={content.alignment}>
        {content.items.map((item) => (
          <div key={item.id} className={styles.stat}>
            {item.icon && <Icon id={item.icon} size={22} />}
            <span className={styles.statValue}>{item.value}</span>
            <span className={styles.statLabel}>{item.label}</span>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}
