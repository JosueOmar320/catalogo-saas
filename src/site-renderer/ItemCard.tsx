import { ImageIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { visibleAttributes } from '@/lib/catalog/attributes';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { CardStyleId } from '@/lib/design/styles-registry';
import type { SiteViewModel } from '@/lib/site/view-model';
import { Badges } from './Badges';
import { ContactActions } from './ContactActions';
import { itemPath, type RenderEnv } from './env';
import { PriceTag } from './PriceTag';
import { SiteImage } from './SiteImage';
import styles from './site.module.css';

/**
 * Campos visibles de una tarjeta. La configuración global de tarjetas del
 * tema actúa como permiso (si el tema oculta precios, se ocultan en todo el
 * sitio); la presentación de cada sección decide dentro de ese permiso.
 */
export type CardFields = {
  image: boolean;
  description: boolean;
  price: boolean;
  sku: boolean;
  category: boolean;
  badges: boolean;
  attributes: 'none' | 'card' | 'all';
  button: boolean;
  compareAt: boolean;
  discount: boolean;
  availability: boolean;
};

export type CardOptions = {
  style?: CardStyleId;
  imagePosition?: SiteViewModel['theme']['cards']['imagePosition'];
  fields?: Partial<CardFields>;
  shape?: 'rect' | 'rounded' | 'circle' | 'arch';
  frame?: boolean;
  align?: 'left' | 'center';
  categoryName?: string;
  sizes?: string;
  priority?: boolean;
  /** Variante de tamaño (tarjetas grandes / destacado de revista). */
  size?: 'normal' | 'large' | 'compact';
};

export function resolveFields(site: SiteViewModel, fields: Partial<CardFields> = {}): CardFields {
  const cards = site.theme.cards;
  return {
    image: fields.image ?? true,
    description: cards.showDescription && (fields.description ?? true),
    price: cards.showPrice && (fields.price ?? true),
    sku: fields.sku ?? cards.showSku,
    category: fields.category ?? cards.showCategory,
    badges: cards.showBadges && (fields.badges ?? true),
    attributes: fields.attributes ?? 'card',
    button: cards.button !== 'none' && (fields.button ?? true),
    compareAt: fields.compareAt ?? true,
    discount: fields.discount ?? false,
    availability: cards.showAvailability && (fields.availability ?? true),
  };
}

export function ItemLink({ item, env, className, children }: { item: CatalogItemView; env: RenderEnv; className: string; children: ReactNode }) {
  // En la preview los ítems de ejemplo o sin publicar no navegan.
  if (env.mode === 'preview') return <div className={className}>{children}</div>;
  return (
    <a href={itemPath(env, item.slug)} className={className}>
      {children}
    </a>
  );
}

export function ItemMedia({ item, className, sizes, priority, shape, frame, index = 0 }: { item: CatalogItemView; className: string; sizes: string; priority?: boolean; shape?: CardOptions['shape']; frame?: boolean; index?: number }) {
  const image = item.images[index] ?? item.images[0];
  return (
    <div className={className} data-shape={shape} data-frame={frame || undefined}>
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

/** Atributos del ítem como "Origen: Chiapas · Tamaño: 12 oz". */
export function ItemAttributes({ item, site, mode, className }: { item: CatalogItemView; site: SiteViewModel; mode: 'card' | 'all'; className?: string }) {
  const attrs = visibleAttributes(item.attributes, site.attributeDefs, mode === 'card' ? 'card' : 'detail').filter((a) => !a.list || mode === 'all');
  if (attrs.length === 0) return null;
  return (
    <ul className={`${styles.attrList} ${className ?? ''}`}>
      {attrs.map((a) => (
        <li key={a.id}>
          <span className={styles.attrName}>{a.name}:</span> {a.value}
        </li>
      ))}
    </ul>
  );
}

/** Tarjeta de ítem. Estilo (7 variantes), forma de imagen, campos y hover configurables. */
export function ItemCard({ item, site, env, options = {} }: { item: CatalogItemView; site: SiteViewModel; env: RenderEnv; options?: CardOptions }) {
  const cards = site.theme.cards;
  const style = options.style ?? cards.style;
  const imagePosition = options.imagePosition ?? cards.imagePosition;
  const f = resolveFields(site, options.fields);

  return (
    <article
      className={`${styles.card} ${item.isAvailable ? '' : styles.unavailable}`}
      data-style={style}
      data-image={f.image ? imagePosition : 'none'}
      data-hover={cards.hover}
      data-align={options.align ?? cards.align}
      data-size={options.size ?? 'normal'}
    >
      <ItemLink item={item} env={env} className={styles.cardLink}>
        {f.image && (
          <div className={styles.mediaWrap}>
            <ItemMedia item={item} className={styles.cardMedia} sizes={options.sizes ?? '(max-width: 600px) 50vw, 300px'} priority={options.priority} shape={options.shape} frame={options.frame} />
            {f.badges && <Badges item={item} theme={site.theme} />}
          </div>
        )}
        <div className={styles.cardBody}>
          {f.category && options.categoryName && <span className={styles.cardEyebrow}>{options.categoryName}</span>}
          <h3 className={styles.cardTitle}>{item.name}</h3>
          {f.description && item.shortDescription && <p className={styles.cardDesc}>{item.shortDescription}</p>}
          {f.attributes !== 'none' && <ItemAttributes item={item} site={site} mode={f.attributes} />}
          {f.sku && item.sku && <span className={styles.cardMeta}>Código: {item.sku}</span>}
          {f.price && <PriceTag item={item} compare={f.compareAt} discount={f.discount} />}
          {f.availability && !item.isAvailable && <span className={styles.availability}>No disponible</span>}
        </div>
      </ItemLink>
      {f.button && item.isAvailable && (
        <div className={styles.cardActions}>
          <ContactActions site={site} item={item} show="primary" small block appearance={cards.button === 'none' ? 'solid' : cards.button} shortLabel="Consultar" />
        </div>
      )}
    </article>
  );
}
