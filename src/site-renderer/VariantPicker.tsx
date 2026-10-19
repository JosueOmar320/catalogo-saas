'use client';

import { useState } from 'react';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { variantOrderItem } from './order/config';
import { AddToOrder } from './order/OrderProvider';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

type Props = {
  item: Pick<CatalogItemView, 'id' | 'name' | 'sku' | 'currency' | 'url' | 'images' | 'variants'>;
  /** Clases y variante del botón principal (las mismas de ContactActions). */
  button: { className: string; variant: string; hover: string } | null;
};

/**
 * Elegir una opción en la ficha (Tamaño: 12 oz / 16 oz). Muestra el precio de
 * la elegida y, si hay pedido por WhatsApp, el botón para agregar esa opción.
 */
export function VariantPicker({ item, button }: Props) {
  const t = useSiteT();
  const variants = item.variants!;
  const [selectedId, setSelectedId] = useState(() => (variants.options.find((o) => o.available) ?? variants.options[0]).id);
  const selected = variants.options.find((o) => o.id === selectedId) ?? variants.options[0];

  return (
    <div className={styles.variants}>
      <div className={styles.variantLabel} id={`variants-${item.id}`}>
        {variants.label}: <strong>{selected.name}</strong>
      </div>
      <div className={styles.variantOptions} role="radiogroup" aria-labelledby={`variants-${item.id}`}>
        {variants.options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === selected.id}
            disabled={!option.available}
            className={styles.variantOption}
            onClick={() => setSelectedId(option.id)}
            title={option.available ? undefined : t('Agotado')}
          >
            {option.name}
            {!option.available && <span className={styles.visuallyHidden}> ({t('Agotado')})</span>}
          </button>
        ))}
      </div>
      {selected.priceLabel && (
        <p className={styles.variantPrice} aria-live="polite">
          {selected.priceLabel}
        </p>
      )}
      {button && selected.available && (
        <div className={styles.btnRow}>
          <AddToOrder item={variantOrderItem(item, selected)} className={button.className} variant={button.variant} hover={button.hover} label={t('Agregar al pedido')} />
        </div>
      )}
    </div>
  );
}
