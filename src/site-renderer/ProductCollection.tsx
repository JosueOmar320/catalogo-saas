import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { visibleAttributes } from '@/lib/catalog/attributes-core';
import type { Presentation } from '@/lib/catalog/presentation';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { Badges } from './Badges';
import type { CatalogClientSite } from './catalog-client-model';
import { ContactActions } from './ContactActions';
import type { RenderEnv } from './env';
import { ImageGallery } from './ImageGallery';
import { ItemAttributes, ItemCard, ItemLink, ItemMedia, resolveFields, type CardOptions } from './ItemCard';
import { PriceTag } from './PriceTag';
import { siteTranslator, siteYesNo } from './site-i18n';
import styles from './site.module.css';
import { CARD_RATIOS } from './theme-vars';

type Props = {
  items: CatalogItemView[];
  /** El modelo completo o el recortado de la sección de catálogo. */
  site: CatalogClientSite;
  env: RenderEnv;
  presentation: Presentation;
  categoryNames: Map<string, string>;
  priority?: boolean;
};

const GAP = { tight: '10px', normal: 'var(--gap-theme)', loose: 'calc(var(--gap-theme) * 1.8)' } as const;
const THUMB = { sm: '64px', md: '96px', lg: '132px' } as const;
const ZIGZAG = { sm: '32%', md: '42%', lg: '52%' } as const;
const SERVICE_THUMB = { sm: '56px', md: '84px', lg: '100%' } as const;

/**
 * Renderer web de una colección de productos según su presentación.
 * El PDF tiene su propio renderer (features/pdf/products.tsx) con la misma
 * configuración: web y PDF no comparten componentes, sí decisiones.
 */
export function ProductCollection({ items, site, env, presentation: p, categoryNames, priority }: Props) {
  const vars = {
    '--cols-d': p.columns.desktop,
    '--cols-t': p.columns.tablet,
    '--cols-m': p.columns.mobile,
    '--gap': GAP[p.gap],
    '--card-ratio': CARD_RATIOS[p.ratio],
    '--thumb': THUMB[p.imageSize],
    '--zig': ZIGZAG[p.imageSize],
    '--svc-thumb': SERVICE_THUMB[p.imageSize],
  } as CSSProperties;
  const cardOptions = (item: CatalogItemView, index: number, extra: Partial<CardOptions> = {}): CardOptions => ({
    style: p.cardStyle === 'inherit' ? undefined : p.cardStyle,
    fields: p.fields,
    shape: p.shape,
    frame: p.frame,
    align: p.align,
    categoryName: item.categoryId ? categoryNames.get(item.categoryId) : undefined,
    sizes: `(max-width: 600px) ${Math.round(100 / p.columns.mobile)}vw, ${Math.round(1200 / p.columns.desktop)}px`,
    priority: priority && index < 4,
    ...extra,
  });
  const f = resolveFields(site, p.fields);
  const t = siteTranslator(site.settings.language);

  switch (p.layout) {
    case 'largeCards':
    case 'grid':
    case 'compactGrid':
    case 'imageFocus':
      return (
        <div className={p.arrangement === 'carousel' ? styles.carousel : styles.grid} style={vars}>
          {items.map((item, i) => (
            <ItemCard
              key={item.id}
              item={item}
              site={site}
              env={env}
              options={cardOptions(item, i, {
                size: p.layout === 'largeCards' ? 'large' : p.layout === 'compactGrid' ? 'compact' : 'normal',
                imagePosition: p.layout === 'imageFocus' ? 'overlay' : 'top',
              })}
            />
          ))}
        </div>
      );

    case 'editorial':
    case 'magazine': {
      const [first, ...rest] = items;
      if (!first) return null;
      return (
        <div className={p.layout === 'editorial' ? styles.editorialGrid : styles.magazine} style={vars}>
          <div className={styles.featureSlot}>
            <ItemCard item={first} site={site} env={env} options={cardOptions(first, 0, { size: 'large', imagePosition: p.layout === 'magazine' ? 'side' : 'top', sizes: '(max-width: 800px) 100vw, 60vw' })} />
          </div>
          {rest.map((item, i) => (
            <ItemCard key={item.id} item={item} site={site} env={env} options={cardOptions(item, i + 1)} />
          ))}
        </div>
      );
    }

    case 'compactList':
      return (
        <div className={styles.compactList} data-separators={p.separators} style={vars}>
          {items.map((item) => (
            <article key={item.id} className={`${styles.compactRow} ${item.isAvailable ? '' : styles.unavailable}`} data-image={p.imagePosition === 'right' ? 'right' : 'left'}>
              <ItemLink item={item} env={env} className={styles.compactLink}>
                {f.image && item.images.length > 0 && <ItemMedia item={item} className={styles.compactMedia} sizes="140px" shape={p.shape} frame={p.frame} />}
                <div className={styles.rowBody}>
                  {f.category && item.categoryId && <span className={styles.cardEyebrow}>{categoryNames.get(item.categoryId)}</span>}
                  <div className={styles.rowTop}>
                    <h3 className={styles.cardTitle}>{item.name}</h3>
                    {f.price && <PriceTag item={item} t={t} compare={f.compareAt} discount={f.discount} />}
                  </div>
                  {f.description && item.shortDescription && <p className={styles.cardDesc}>{item.shortDescription}</p>}
                  {f.attributes !== 'none' && <ItemAttributes item={item} site={site} mode={f.attributes} />}
                  {f.sku && item.sku && <span className={styles.cardMeta}>{t('Código: {sku}', { sku: item.sku })}</span>}
                  {f.badges && <Badges item={item} theme={site.theme} t={t} inline />}
                  {f.availability && !item.isAvailable && <span className={styles.availability}>{t('No disponible')}</span>}
                </div>
              </ItemLink>
              {f.button && item.isAvailable && <ContactActions site={site} item={item} env={env} show="primary" small appearance="icon" />}
            </article>
          ))}
        </div>
      );

    case 'priceList':
      return (
        <div className={styles.priceList} data-separators={p.separators} style={{ ...vars, '--pl-cols': Math.min(p.columns.desktop, 2) } as CSSProperties}>
          {items.map((item) => (
            <ItemLink key={item.id} item={item} env={env} className={styles.priceListItem}>
              {f.image && item.images.length > 0 && <ItemMedia item={item} className={styles.priceListMedia} sizes="80px" shape={p.shape} />}
              <div className={styles.priceListBody}>
                <div className={styles.priceListTop}>
                  <span className={styles.priceListName}>{item.name}</span>
                  <span className={styles.leader} aria-hidden />
                  {f.price && <span className={styles.price}>{item.priceLabel ?? item.priceNote ?? t('Consultar')}</span>}
                </div>
                {f.description && item.shortDescription && <p className={styles.cardDesc}>{item.shortDescription}</p>}
                {f.attributes !== 'none' && <ItemAttributes item={item} site={site} mode={f.attributes} />}
                {f.sku && item.sku && <span className={styles.cardMeta}>{t('Código: {sku}', { sku: item.sku })}</span>}
              </div>
            </ItemLink>
          ))}
        </div>
      );

    case 'zigzag':
      return (
        <div className={styles.zigzag} style={vars}>
          {items.map((item, i) => {
            const right = p.imagePosition === 'right' || (p.imagePosition === 'alternate' && i % 2 === 1);
            return (
              <article key={item.id} className={styles.zigzagItem} data-reverse={right} data-media={f.image && item.images.length > 0}>
                {f.image && item.images.length > 0 && <ItemMedia item={item} className={styles.zigzagMedia} sizes="(max-width: 700px) 100vw, 45vw" shape={p.shape} frame={p.frame} priority={priority && i === 0} />}
                <div className={styles.zigzagBody}>
                  {f.badges && <Badges item={item} theme={site.theme} t={t} inline />}
                  {f.category && item.categoryId && <span className={styles.eyebrow}>{categoryNames.get(item.categoryId)}</span>}
                  <ItemLink item={item} env={env} className={styles.cardLink}>
                    <h3 className={styles.h3}>{item.name}</h3>
                  </ItemLink>
                  {f.description && item.shortDescription && <p className={styles.muted}>{item.shortDescription}</p>}
                  {f.attributes !== 'none' && <ItemAttributes item={item} site={site} mode={f.attributes} />}
                  {f.sku && item.sku && <span className={styles.cardMeta}>{t('Código: {sku}', { sku: item.sku })}</span>}
                  {f.price && <div className={styles.bigPrice}><PriceTag item={item} t={t} compare={f.compareAt} discount={f.discount} /></div>}
                  {f.button && item.isAvailable && (
                    <div className={styles.btnRow}>
                      <ContactActions site={site} item={item} env={env} show="primary" small />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      );

    case 'detail':
      return (
        <div className={styles.detailList}>
          {items.map((item) => {
            const specs = visibleAttributes(item.attributes, site.attributeDefs, 'detail', siteYesNo(site.settings.language));
            return (
              <article key={item.id} className={styles.detailBlock} data-reverse={p.imagePosition === 'right'}>
                <div className={styles.mediaWrap}>
                  {p.gallery ? <ImageGallery images={item.images} name={item.name} /> : <ItemMedia item={item} className={styles.galleryMain} sizes="(max-width: 820px) 100vw, 600px" shape={p.shape} />}
                  {f.badges && <Badges item={item} theme={site.theme} t={t} />}
                </div>
                <div className={styles.detailInfo}>
                  {f.category && item.categoryId && <span className={styles.eyebrow}>{categoryNames.get(item.categoryId)}</span>}
                  <h3 className={styles.h2}>{item.name}</h3>
                  {f.sku && item.sku && <span className={styles.cardMeta}>{t('Código: {sku}', { sku: item.sku })}</span>}
                  {f.price && <div className={styles.bigPrice}><PriceTag item={item} t={t} compare={f.compareAt} discount={f.discount} /></div>}
                  {f.description && (item.description || item.shortDescription) && <p className={styles.preLine}>{item.description ?? item.shortDescription}</p>}
                  {specs.length > 0 && (
                    <table className={styles.specs}>
                      <tbody>
                        {specs.map((spec) => (
                          <tr key={spec.id}>
                            <th scope="row">{spec.name}</th>
                            <td>{spec.list ? <ul>{spec.list.map((x) => <li key={x}>{x}</li>)}</ul> : spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {f.button && item.isAvailable && (
                    <div className={styles.btnRow}>
                      <ContactActions site={site} item={item} env={env} />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      );

    case 'minimal':
      return (
        <div className={`${styles.grid} ${styles.minimal}`} data-align={p.align} style={vars}>
          {items.map((item, i) => (
            <ItemLink key={item.id} item={item} env={env} className={`${styles.minimalItem} ${item.isAvailable ? '' : styles.unavailable}`}>
              {f.image && <ItemMedia item={item} className={styles.cardMedia} sizes={cardOptions(item, i).sizes ?? '300px'} shape={p.shape} frame={p.frame} priority={priority && i < 4} />}
              {f.category && item.categoryId && <span className={styles.cardEyebrow}>{categoryNames.get(item.categoryId)}</span>}
              <h3 className={styles.minimalName}>{item.name}</h3>
              {f.price && <PriceTag item={item} t={t} compare={f.compareAt} discount={f.discount} />}
              {f.availability && !item.isAvailable && <span className={styles.availability}>{t('No disponible')}</span>}
            </ItemLink>
          ))}
        </div>
      );

    case 'serviceCards':
      return (
        <div className={styles.grid} style={vars}>
          {items.map((item, i) => {
            const details = f.attributes === 'none' ? [] : visibleAttributes(item.attributes, site.attributeDefs, f.attributes === 'all' ? 'detail' : 'card', siteYesNo(site.settings.language));
            return (
              <article key={item.id} className={`${styles.card} ${styles.serviceCard} ${item.isAvailable ? '' : styles.unavailable}`} data-style={p.cardStyle === 'inherit' ? site.theme.cards.style : p.cardStyle} data-hover={site.theme.cards.hover} data-align={p.align} data-media={p.imageSize === 'lg' ? 'cover' : 'thumb'}>
                {f.image && item.images.length > 0 && <ItemMedia item={item} className={styles.serviceMedia} sizes={p.imageSize === 'lg' ? cardOptions(item, i).sizes ?? '400px' : '100px'} shape={p.shape} frame={p.frame} priority={priority && i < 3} />}
                <div className={styles.serviceBody}>
                  {f.badges && <Badges item={item} theme={site.theme} t={t} inline />}
                  {f.category && item.categoryId && <span className={styles.cardEyebrow}>{categoryNames.get(item.categoryId)}</span>}
                  <ItemLink item={item} env={env} className={styles.serviceLink}>
                    <h3 className={styles.serviceTitle}>{item.name}</h3>
                  </ItemLink>
                  {f.description && item.shortDescription && <p className={styles.cardDesc}>{item.shortDescription}</p>}
                  {details.length > 0 && (
                    <ul className={styles.serviceIncludes}>
                      {details.map((d) => (
                        <li key={d.id}>
                          <Check size={16} aria-hidden />
                          <span>
                            <span className={styles.attrName}>{d.name}:</span> {d.list ? d.list.join(', ') : d.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {f.sku && item.sku && <span className={styles.cardMeta}>{t('Código: {sku}', { sku: item.sku })}</span>}
                  {f.availability && !item.isAvailable && <span className={styles.availability}>{t('No disponible')}</span>}
                  {(f.price || (f.button && item.isAvailable)) && (
                    <div className={styles.serviceFoot}>
                      {f.price && <div className={styles.bigPrice}><PriceTag item={item} t={t} compare={f.compareAt} discount={f.discount} /></div>}
                      {f.button && item.isAvailable && <ContactActions site={site} item={item} env={env} show="primary" small block appearance={site.theme.cards.button === 'none' ? 'solid' : site.theme.cards.button} />}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      );

    case 'comparison': {
      // Atributos que al menos un ítem tiene (una columna de "—" no compara nada).
      const context = f.attributes === 'all' ? 'detail' : 'card';
      const defs = site.attributeDefs.filter((d) => (context === 'detail' ? d.showInDetail : d.showInCard) && items.some((i) => i.attributes[d.id] !== undefined));
      const value = (item: CatalogItemView, id: string) => visibleAttributes(item.attributes, site.attributeDefs, context, siteYesNo(site.settings.language)).find((a) => a.id === id);
      return (
        <div className={styles.comparisonWrap} style={vars}>
          <table className={styles.comparison}>
            <thead>
              <tr>
                <th scope="col">{t('Producto')}</th>
                {f.price && <th scope="col">{t('Precio')}</th>}
                {f.attributes !== 'none' && defs.map((d) => <th key={d.id} scope="col">{d.name}</th>)}
                {f.sku && <th scope="col">{t('Código')}</th>}
                {f.button && <th scope="col"><span className={styles.visuallyHidden}>{t('Acción')}</span></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.isAvailable ? undefined : styles.unavailable}>
                  <th scope="row">
                    <ItemLink item={item} env={env} className={styles.comparisonItem}>
                      {f.image && <ItemMedia item={item} className={styles.compactMedia} sizes="96px" shape={p.shape} />}
                      <span>
                        <span className={styles.cardTitle}>{item.name}</span>
                        {f.badges && <Badges item={item} theme={site.theme} t={t} inline />}
                        {f.availability && !item.isAvailable && <span className={styles.availability}>{t('No disponible')}</span>}
                      </span>
                    </ItemLink>
                  </th>
                  {f.price && <td><PriceTag item={item} t={t} compare={f.compareAt} discount={f.discount} /></td>}
                  {f.attributes !== 'none' && defs.map((d) => {
                    const attr = value(item, d.id);
                    return <td key={d.id}>{attr ? (attr.list ? attr.list.join(', ') : attr.value) : '—'}</td>;
                  })}
                  {f.sku && <td>{item.sku ?? '—'}</td>}
                  {f.button && <td>{item.isAvailable && <ContactActions site={site} item={item} env={env} show="primary" small appearance="icon" />}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
}
