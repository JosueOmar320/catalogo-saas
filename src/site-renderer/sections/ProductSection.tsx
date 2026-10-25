import { ArrowRight } from 'lucide-react';
import { visibleAttributes } from '@/lib/catalog/attributes-core';
import { resolveSpotlightItem } from '@/lib/site/resolve';
import { Badges } from '../Badges';
import { ContactActions } from '../ContactActions';
import { DietTags } from '../diet';
import { itemPath } from '../env';
import { ImageGallery } from '../ImageGallery';
import { ItemMedia } from '../ItemCard';
import { orderable } from '../order/config';
import { PriceTag } from '../PriceTag';
import { RatingBadge } from '../Reviews';
import { Placeholder, SectionFrame } from '../SectionFrame';
import { buttonVariant } from '../SiteButton';
import { SiteImage } from '../SiteImage';
import { siteTranslator, siteYesNo } from '../site-i18n';
import { VariantPicker } from '../VariantPicker';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/**
 * Un producto o servicio en específico (el «producto del mes», un servicio
 * estrella): sus fotos, precio, lo que incluye y el botón para pedirlo, en
 * cualquier lugar de la página. Sin elegir, muestra el primer destacado.
 */
export function ProductSection({ section, site, env, index }: SectionProps<'product'>) {
  const c = section.content;
  const t = siteTranslator(site.settings.language);
  const item = resolveSpotlightItem(c, site.items);
  if (!item) {
    if (env.mode === 'public') return null;
    return (
      <SectionFrame section={section} theme={site.theme}>
        <Placeholder show>{c.itemId ? t('El producto elegido ya no está en el catálogo: elige otro en el editor.') : t('Agrega productos a tu catálogo para mostrarlos aquí.')}</Placeholder>
      </SectionFrame>
    );
  }

  const cards = site.theme.cards;
  const category = site.categories.find((cat) => cat.id === item.categoryId);
  const specs = c.showSpecs ? visibleAttributes(item.attributes, site.attributeDefs, 'detail', siteYesNo(site.settings.language)) : [];
  const title = c.title || item.name;
  const eyebrow = c.eyebrow || category?.name || '';
  const description = c.showDescription && c.layout !== 'banner' ? item.description : null;
  // La descripción corta no se repite si la larga ya empieza con ella.
  const lead = c.subtitle || (item.shortDescription && !description?.startsWith(item.shortDescription) ? item.shortDescription : null);
  const detailsLink = c.showDetailsLink && env.mode !== 'preview' ? itemPath(env, item.slug) : null;
  const Heading = index === 0 ? 'h1' : 'h2';
  const picker = c.showOrder && item.isAvailable && (item.variants || item.extras);

  const info = (
    <div className={styles.spotInfo}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      {c.showBadges && c.layout === 'banner' && <Badges item={item} theme={site.theme} t={t} inline />}
      <Heading className={styles.h2}>{title}</Heading>
      {site.settings.reviews.enabled && <RatingBadge site={site} item={item} />}
      {cards.showPrice && <div className={styles.bigPrice}><PriceTag item={item} t={t} discount /></div>}
      {!item.isAvailable && <span className={styles.availability}>{t('No disponible por ahora')}</span>}
      {lead && <p className={styles.lead}>{lead}</p>}
      {description && <p className={styles.preLine}>{description}</p>}
      <DietTags tags={item.diet} t={t} />
      {specs.length > 0 && c.layout !== 'banner' && (
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
      {picker && c.layout !== 'banner' && <VariantPicker item={item} button={orderable(site, item) ? { className: styles.btn, variant: buttonVariant(site.theme, 'primary'), hover: site.theme.buttons.hover } : null} />}
      {(c.showOrder || detailsLink) && (
        <div className={styles.btnRow}>
          {/* En el banner no caben las variantes: el botón lleva a la ficha, donde se eligen. */}
          {c.showOrder && item.isAvailable && !(picker && c.layout === 'banner') && <ContactActions site={site} item={item} env={env} show="primary" skipOrder={Boolean(picker)} />}
          {detailsLink && (
            <a href={detailsLink} className={styles.btn} data-variant={buttonVariant(site.theme, picker && c.layout === 'banner' ? 'primary' : 'secondary')} data-hover={site.theme.buttons.hover}>
              {picker && c.layout === 'banner' ? t('Elegir opciones') : t('Ver detalles')} <ArrowRight size={16} aria-hidden />
            </a>
          )}
        </div>
      )}
    </div>
  );

  if (c.layout === 'banner') {
    const image = item.images[0];
    return (
      <SectionFrame section={{ ...section, style: { ...section.style, width: 'full', paddingTop: 'none', paddingBottom: 'none' } }} theme={site.theme} className={styles.embedFullScreen}>
        <div className={styles.spotBanner} data-side={c.imageSide}>
          {image && <SiteImage src={image.url} alt={image.alt} sizes="100vw" priority={index === 0} className={styles.spotBannerImage} />}
          <div className={styles.spotBannerShade} aria-hidden />
          <div className={`${styles.container} ${styles.spotBannerInner}`}>{info}</div>
        </div>
      </SectionFrame>
    );
  }

  const media = (
    <div className={styles.mediaWrap}>
      {c.gallery && item.images.length > 1 ? <ImageGallery images={item.images} name={item.name} priority={index === 0} /> : <ItemMedia item={item} className={styles.galleryMain} sizes="(max-width: 820px) 100vw, 600px" priority={index === 0} />}
      {c.showBadges && <Badges item={item} theme={site.theme} t={t} />}
    </div>
  );

  return (
    <SectionFrame section={section} theme={site.theme}>
      <article className={c.layout === 'card' ? styles.spotCard : styles.spotSplit} data-reverse={c.imageSide === 'right'} data-style={c.layout === 'card' ? (cards.style === 'minimal' || cards.style === 'borderless' ? 'classic' : cards.style) : undefined}>
        {media}
        {info}
      </article>
    </SectionFrame>
  );
}
