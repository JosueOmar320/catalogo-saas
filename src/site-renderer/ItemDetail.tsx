import { ArrowLeft } from 'lucide-react';
import { visibleAttributes } from '@/lib/catalog/attributes';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { SiteViewModel } from '@/lib/site/view-model';
import { Badges } from './Badges';
import { ContactActions } from './ContactActions';
import { ImageGallery } from './ImageGallery';
import { PriceTag } from './PriceTag';
import styles from './site.module.css';

/** Ficha de un producto/servicio (URL propia para SEO y para compartir). */
export function ItemDetail({ site, item, backHref }: { site: SiteViewModel; item: CatalogItemView; backHref: string }) {
  const category = site.categories.find((c) => c.id === item.categoryId);
  const specs = visibleAttributes(item.attributes, site.attributeDefs, 'detail');
  return (
    <div className={styles.container}>
      <a href={backHref} className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden /> Volver
      </a>
      <div className={styles.detail}>
        <div className={styles.mediaWrap}>
          <ImageGallery images={item.images} name={item.name} />
          <Badges item={item} theme={site.theme} />
        </div>
        <div className={styles.detailInfo}>
          {category && <span className={styles.eyebrow}>{category.name}</span>}
          <h1 className={styles.h2}>{item.name}</h1>
          {site.theme.cards.showPrice && <PriceTag item={item} discount />}
          {!item.isAvailable && <span className={styles.availability}>No disponible por ahora</span>}
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
          {item.sku && <span className={styles.cardMeta}>Código: {item.sku}</span>}
          {item.tags.length > 0 && (
            <div className={styles.tags}>
              {item.tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
          <div className={styles.btnRow}>
            <ContactActions site={site} item={item} />
          </div>
        </div>
      </div>
    </div>
  );
}
