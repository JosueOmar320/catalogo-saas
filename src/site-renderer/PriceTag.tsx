import { discountPercent } from '@/lib/catalog/price';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { Translator } from '@/i18n/translate';
import styles from './site.module.css';

/** Precio del ítem. `compare` muestra el precio anterior tachado; `discount`, el porcentaje. `t`: textos en el idioma del sitio. */
export function PriceTag({ item, t, compare = true, discount = false }: { item: CatalogItemView; t: Translator; compare?: boolean; discount?: boolean }) {
  if (!item.priceLabel) {
    return (
      <div className={styles.priceRow}>
        <span className={styles.priceNote}>{item.priceNote ?? t('Precio a consultar')}</span>
      </div>
    );
  }
  const percent = discount ? discountPercent(item) : null;
  return (
    <div className={styles.priceRow}>
      {item.priceNote === 'desde' && <span className={styles.priceNote}>{t('desde')}</span>}
      <span className={styles.price}>{item.priceLabel}</span>
      {compare && item.compareAtLabel && <span className={styles.comparePrice}>{item.compareAtLabel}</span>}
      {percent !== null && <span className={styles.discount}>-{percent}%</span>}
      {item.priceNote && item.priceNote !== 'desde' && <span className={styles.priceNote}>{item.priceNote}</span>}
    </div>
  );
}
