import { ImageIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { CardStyleId } from '@/lib/design/styles-registry';
import type { SiteViewModel } from '@/lib/site/view-model';
import { Badges } from './Badges';
import { ContactActions } from './ContactActions';
import { itemPath, type RenderEnv } from './env';
import { PriceTag } from './PriceTag';
import { SiteImage } from './SiteImage';
import styles from './site.module.css';

export type CardOptions = {
  style?: CardStyleId;
  imagePosition?: SiteViewModel['theme']['cards']['imagePosition'];
  showPrice?: boolean;
  showDescription?: boolean;
  showImage?: boolean;
  categoryName?: string;
  sizes?: string;
  priority?: boolean;
};

export function ItemLink({ item, env, className, children }: { item: CatalogItemView; env: RenderEnv; className: string; children: ReactNode }) {
  // En la preview los ítems de ejemplo o sin publicar no navegan.
  if (env.mode === 'preview') return <div className={className}>{children}</div>;
  return (
    <a href={itemPath(env, item.slug)} className={className}>
      {children}
    </a>
  );
}

export function ItemMedia({ item, className, sizes, priority }: { item: CatalogItemView; className: string; sizes: string; priority?: boolean }) {
  const image = item.images[0];
  return (
    <div className={className}>
      {image ? (
        <SiteImage src={image.url} alt={image.alt} sizes={sizes} priority={priority} />
      ) : (
        <div className={styles.mediaPlaceholder}>
          <ImageIcon size={30} strokeWidth={1.5} aria-hidden />
        </div>
      )}
    </div>
  );
}

/**
 * Tarjeta de ítem. El estilo (7 variantes), la posición de imagen y el hover
 * vienen del tema y pueden sobrescribirse por sección.
 */
export function ItemCard({ item, site, env, options = {} }: { item: CatalogItemView; site: SiteViewModel; env: RenderEnv; options?: CardOptions }) {
  const cards = site.theme.cards;
  const style = options.style ?? cards.style;
  const imagePosition = options.imagePosition ?? cards.imagePosition;
  const showImage = options.showImage ?? true;
  const showPrice = cards.showPrice && (options.showPrice ?? true);
  const showDescription = cards.showDescription && (options.showDescription ?? true);

  return (
    <article
      className={`${styles.card} ${item.isAvailable ? '' : styles.unavailable}`}
      data-style={style}
      data-image={showImage ? imagePosition : 'none'}
      data-hover={cards.hover}
      data-align={cards.align}
    >
      <ItemLink item={item} env={env} className={styles.cardLink}>
        {showImage && (
          <div className={styles.mediaWrap}>
            <ItemMedia item={item} className={styles.cardMedia} sizes={options.sizes ?? '(max-width: 600px) 50vw, 300px'} priority={options.priority} />
            {cards.showBadges && <Badges item={item} theme={site.theme} />}
          </div>
        )}
        <div className={styles.cardBody}>
          {cards.showCategory && options.categoryName && <span className={styles.cardEyebrow}>{options.categoryName}</span>}
          <h3 className={styles.cardTitle}>{item.name}</h3>
          {showDescription && item.shortDescription && <p className={styles.cardDesc}>{item.shortDescription}</p>}
          {cards.showSku && item.sku && <span className={styles.cardMeta}>Código: {item.sku}</span>}
          {showPrice && <PriceTag item={item} />}
          {cards.showAvailability && !item.isAvailable && <span className={styles.availability}>No disponible</span>}
        </div>
      </ItemLink>
      {cards.button !== 'none' && item.isAvailable && (
        <div className={styles.cardActions}>
          <ContactActions site={site} item={item} show="primary" small block appearance={cards.button} shortLabel="Consultar" />
        </div>
      )}
    </article>
  );
}

/** Fila compacta (layout "lista" del catálogo y de servicios). */
export function ItemRow({ item, site, env, categoryName }: { item: CatalogItemView; site: SiteViewModel; env: RenderEnv; categoryName?: string }) {
  const cards = site.theme.cards;
  return (
    <article className={`${styles.row} ${item.isAvailable ? '' : styles.unavailable}`}>
      <ItemLink item={item} env={env} className={styles.rowLink}>
        {item.images.length > 0 && <ItemMedia item={item} className={styles.rowMedia} sizes="96px" />}
        <div className={styles.rowBody}>
          {cards.showCategory && categoryName && <span className={styles.cardEyebrow}>{categoryName}</span>}
          <div className={styles.rowTop}>
            <h3 className={styles.cardTitle}>{item.name}</h3>
            {cards.showPrice && <PriceTag item={item} />}
          </div>
          {cards.showDescription && item.shortDescription && <p className={styles.cardDesc}>{item.shortDescription}</p>}
          {cards.showAvailability && !item.isAvailable && <span className={styles.availability}>No disponible</span>}
        </div>
      </ItemLink>
      {cards.button !== 'none' && item.isAvailable && <ContactActions site={site} item={item} show="primary" small appearance="icon" />}
    </article>
  );
}
