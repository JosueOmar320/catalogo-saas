import { resolveSectionItems } from '@/lib/site/resolve';
import { ItemCard } from '../ItemCard';
import { ItemRow } from '../ItemCard';
import { gridVars, Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { SiteButton } from '../SiteButton';
import styles from '../site.module.css';
import type { SectionProps } from './types';

export function ProductsSection({ section, site, env, links, index }: SectionProps<'products'>) {
  const { content } = section;
  const items = resolveSectionItems(content, site.items);
  const categoryNames = new Map(site.categories.map((c) => [c.id, c.name]));
  if (items.length === 0 && env.mode === 'public') return null;
  const center = site.theme.cards.align === 'center';

  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center={center} />
      <Placeholder show={items.length === 0}>
        {content.source === 'featured' ? 'Marca ítems como "Destacado" para que aparezcan aquí.' : 'No hay ítems que coincidan con esta selección.'}
      </Placeholder>
      {content.layout === 'list' ? (
        <div className={styles.list}>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} site={site} env={env} categoryName={item.categoryId ? categoryNames.get(item.categoryId) : undefined} />
          ))}
        </div>
      ) : (
        <div className={content.layout === 'carousel' ? styles.carousel : styles.grid} style={gridVars(content.columns)}>
          {items.map((item, i) => (
            <ItemCard
              key={item.id}
              item={item}
              site={site}
              env={env}
              options={{
                style: content.cardStyle === 'inherit' ? undefined : content.cardStyle,
                showPrice: content.showPrice,
                showDescription: content.showDescription,
                showImage: content.showImage,
                categoryName: item.categoryId ? categoryNames.get(item.categoryId) : undefined,
                sizes: `(max-width: 600px) ${Math.round(100 / content.columns.mobile)}vw, ${Math.round(1200 / content.columns.desktop)}px`,
                priority: index === 0 && i < 4,
              }}
            />
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
