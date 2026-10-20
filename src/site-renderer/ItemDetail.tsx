import { ArrowLeft } from 'lucide-react';
import { visibleAttributes } from '@/lib/catalog/attributes';
import { shortTime } from '@/lib/business/schedule';
import { formatSaleDate } from '@/lib/catalog/sale';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import { Badges } from './Badges';
import { ContactActions } from './ContactActions';
import type { RenderEnv } from './env';
import { ImageGallery } from './ImageGallery';
import { ItemCard } from './ItemCard';
import { orderable } from './order/config';
import { PriceTag } from './PriceTag';
import { buttonVariant } from './SiteButton';
import { VariantPicker } from './VariantPicker';
import { DietTags } from './diet';
import { relatedItems } from './related';
import { ShareItem } from './ShareItem';
import { siteTranslator, siteYesNo } from './site-i18n';
import styles from './site.module.css';

/** Ficha de un producto/servicio (URL propia para SEO y para compartir). */
export function ItemDetail({ site, item, backHref, env }: { site: SiteViewModel; item: CatalogItemView; backHref: string; env: RenderEnv }) {
  const category = site.categories.find((c) => c.id === item.categoryId);
  const specs = visibleAttributes(item.attributes, site.attributeDefs, 'detail', siteYesNo(site.settings.language));
  const t = siteTranslator(site.settings.language);
  const related = relatedItems(site, item);
  return (
    <div className={styles.container}>
      <a href={backHref} className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden /> {t('Volver')}
      </a>
      <div className={styles.detail}>
        <div className={styles.mediaWrap}>
          <ImageGallery images={item.images} name={item.name} />
          <Badges item={item} theme={site.theme} t={t} />
        </div>
        <div className={styles.detailInfo}>
          {category && <span className={styles.eyebrow}>{category.name}</span>}
          <h1 className={styles.h2}>{item.name}</h1>
          {site.theme.cards.showPrice && <PriceTag item={item} t={t} discount />}
          {site.theme.cards.showPrice && item.saleEndsOn && (
            <span className={styles.saleEnds}>{t('Oferta hasta el {date}', { date: formatSaleDate(item.saleEndsOn, site.settings.locale) })}</span>
          )}
          {!item.isAvailable && <span className={styles.availability}>{t('No disponible por ahora')}</span>}
          <DietTags tags={item.diet} t={t} />
          {item.orderHours && (
            <span className={styles.cardMeta}>{t('Se pide de {from} a {to}', { from: shortTime(item.orderHours.from), to: shortTime(item.orderHours.to) })}</span>
          )}
          {item.shortDescription && <p className={styles.lead}>{item.shortDescription}</p>}
          {item.description && <p className={styles.preLine}>{item.description}</p>}
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
          {item.sku && <span className={styles.cardMeta}>{t('Código: {sku}', { sku: item.sku })}</span>}
          {item.tags.length > 0 && (
            <div className={styles.tags}>
              {item.tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
          {(item.variants || item.extras) && (
            <VariantPicker
              item={item}
              button={orderable(site, item) ? { className: styles.btn, variant: buttonVariant(site.theme, 'primary'), hover: site.theme.buttons.hover } : null}
            />
          )}
          <div className={styles.btnRow}>
            <ContactActions site={site} item={item} skipOrder={Boolean(item.variants || item.extras)} />
          </div>
          <ShareItem name={item.name} url={item.url} />
        </div>
      </div>
      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="related-title">
          <h2 id="related-title" className={styles.relatedTitle}>{t('También te puede interesar')}</h2>
          <div className={styles.relatedGrid}>
            {related.map((other) => (
              <ItemCard key={other.id} item={other} site={site} env={env} options={{ sizes: '(max-width: 600px) 50vw, 280px', categoryName: site.categories.find((c) => c.id === other.categoryId)?.name }} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
