import type { CatalogItemView } from '@/lib/catalog/view-model';
import styles from './site.module.css';

export function PriceTag({ item }: { item: CatalogItemView }) {
  if (!item.priceLabel) {
    return (
      <div className={styles.priceRow}>
        <span className={styles.priceNote}>{item.priceNote ?? 'Precio a consultar'}</span>
      </div>
    );
  }
  return (
    <div className={styles.priceRow}>
      {item.priceNote === 'desde' && <span className={styles.priceNote}>desde</span>}
      <span className={styles.price}>{item.priceLabel}</span>
      {item.compareAtLabel && <span className={styles.comparePrice}>{item.compareAtLabel}</span>}
      {item.priceNote && item.priceNote !== 'desde' && <span className={styles.priceNote}>{item.priceNote}</span>}
    </div>
  );
}
