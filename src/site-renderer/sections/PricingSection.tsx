import { Check } from 'lucide-react';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function PricingSection({ section, site, env, links }: SectionProps<'pricing'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  if (content.plans.length === 0 && env.mode === 'public') return null;
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center />
      <Placeholder show={content.plans.length === 0}>{t('Agrega planes o paquetes desde el editor.')}</Placeholder>
      <div className={`${styles.grid} ${styles.pricing}`} style={gridVars({ ...content.columns, desktop: Math.min(content.columns.desktop, Math.max(content.plans.length, 1)) })}>
        {content.plans.map((plan) => (
          <article key={plan.id} className={styles.pricingCard} data-highlighted={plan.highlighted || undefined}>
            {plan.badge && <span className={styles.pricingBadge}>{plan.badge}</span>}
            <h3 className={styles.h3}>{plan.name}</h3>
            {plan.description && <p className={styles.muted}>{plan.description}</p>}
            <div className={styles.pricingPrice}>
              <span>{plan.price}</span>
              {plan.period && <small>{plan.period}</small>}
            </div>
            {plan.features.length > 0 && (
              <ul className={styles.pricingFeatures}>
                {plan.features.filter(Boolean).map((feature, i) => (
                  <li key={i}>
                    <Check size={16} aria-hidden /> {feature}
                  </li>
                ))}
              </ul>
            )}
            {plan.button.label && (
              <div className={styles.pricingAction}>
                <SiteButton button={plan.highlighted ? plan.button : { ...plan.button, variant: 'secondary' }} theme={site.theme} links={links} env={env} />
              </div>
            )}
          </article>
        ))}
      </div>
    </SectionFrame>
  );
}
