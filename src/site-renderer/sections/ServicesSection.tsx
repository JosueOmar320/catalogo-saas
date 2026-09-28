import { resolveSectionItems } from '@/lib/site/resolve';
import { ContactActions } from '../ContactActions';
import { ItemCard, ItemLink, ItemMedia } from '../ItemCard';
import { PriceTag } from '../PriceTag';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/** Servicios: foco en descripción, precio ("desde") y botón de consulta. */
export function ServicesSection({ section, site, env, links }: SectionProps<'services'>) {
  const { content } = section;
  const items = resolveSectionItems(content, site.items);
  if (items.length === 0 && env.mode === 'public') return null;
  const showPrice = site.theme.cards.showPrice && content.showPrice;
  const showDescription = content.showDescription;

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />
      <Placeholder show={items.length === 0}>Crea servicios en Catálogo › Servicios para que aparezcan aquí.</Placeholder>

      {content.layout === 'cards' && (
        <div className={styles.grid} style={gridVars(content.columns)}>
          {items.map((item) =>
            content.showImage && content.cardStyle !== 'inherit' ? (
              <ItemCard key={item.id} item={item} site={site} env={env} options={{ style: content.cardStyle, showPrice, showDescription }} />
            ) : (
              <article key={item.id} className={styles.serviceCard}>
                {content.showImage && item.images.length > 0 && <ItemMedia item={item} className={styles.serviceMedia} sizes="96px" />}
                <div className={styles.serviceBody}>
                  <ItemLink item={item} env={env} className={styles.cardLink}>
                    <h3 className={styles.h3}>{item.name}</h3>
                  </ItemLink>
                  {showDescription && item.shortDescription && <p className={styles.cardDesc}>{item.shortDescription}</p>}
                  {showPrice && <PriceTag item={item} />}
                  <div className={styles.btnRow}>
                    <ContactActions site={site} item={item} show="primary" small />
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      )}

      {content.layout === 'rows' && (
        <div className={styles.serviceRows}>
          {items.map((item) => (
            <article key={item.id} className={styles.serviceRow}>
              <div>
                <h3 className={styles.h3}>{item.name}</h3>
                {showDescription && item.shortDescription && <p className={`${styles.muted} ${styles.tightText}`}>{item.shortDescription}</p>}
              </div>
              {showPrice ? <PriceTag item={item} /> : <span />}
              <div className={styles.btnRow}>
                <ContactActions site={site} item={item} show="primary" small />
              </div>
            </article>
          ))}
        </div>
      )}

      {content.layout === 'compact' && (
        <div>
          {items.map((item) => (
            <div key={item.id} className={styles.serviceCompact}>
              <div>
                <strong className={styles.cardTitle}>{item.name}</strong>
                {showDescription && item.shortDescription && <div className={styles.cardDesc}>{item.shortDescription}</div>}
              </div>
              {showPrice && <PriceTag item={item} />}
            </div>
          ))}
        </div>
      )}

      {content.button.label && (
        <div className={styles.sectionFoot}>
          <SiteButton button={content.button} theme={site.theme} links={links} env={env} />
        </div>
      )}
    </SectionFrame>
  );
}
