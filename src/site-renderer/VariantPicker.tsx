'use client';

import { useState } from 'react';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { optionOrderItem } from './order/config';
import { AddToOrder, useOrderPricing } from './order/OrderProvider';
import { formatAmount } from './order/message';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

type Props = {
  item: Pick<CatalogItemView, 'id' | 'name' | 'sku' | 'currency' | 'url' | 'images' | 'price' | 'priceLabel' | 'variants' | 'extras'>;
  /** Clases y variante del botón principal (las mismas de ContactActions). */
  button: { className: string; variant: string; hover: string } | null;
};

/**
 * En la ficha: elegir una opción (Tamaño: 12 oz / 16 oz) y, si los tiene,
 * extras (Shot extra +$12…, hasta `max`). Muestra el precio de lo elegido y,
 * si hay pedido por WhatsApp, el botón para agregar esa combinación.
 */
export function VariantPicker({ item, button }: Props) {
  const t = useSiteT();
  const pricing = useOrderPricing();
  const { variants, extras } = item;
  const [selectedId, setSelectedId] = useState(() => (variants ? (variants.options.find((o) => o.available) ?? variants.options[0]).id : null));
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const selected = variants ? (variants.options.find((o) => o.id === selectedId) ?? variants.options[0]) : null;
  const chosenExtras = extras ? extras.options.filter((o) => extraIds.includes(o.id)) : [];
  const line = optionOrderItem(item, selected, chosenExtras);
  const full = extras?.max !== null && extras?.max !== undefined && chosenExtras.length >= extras.max;
  const available = selected ? selected.available : true;
  // Precio de lo elegido: con extras se suma (formato del catálogo si hay pedido; si no, el de la opción).
  const priceText = line.price !== null && pricing ? formatAmount(line.price, pricing) : (line.priceLabel ?? selected?.priceLabel ?? null);
  const toggle = (id: string) => setExtraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  // Grupo de radios con teclado: Tab entra en la opción elegida; las flechas cambian de opción (Home/End: primera/última).
  const options = variants?.options ?? [];
  const firstAvailable = options.find((o) => o.available) ?? null;
  const tabStop = selected?.available ? selected.id : firstAvailable?.id;
  const onOptionKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const available = options.filter((o) => o.available);
    if (!selected || available.length === 0) return;
    const index = available.findIndex((o) => o.id === selected.id);
    let next: (typeof available)[number] | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = available[(index + 1) % available.length];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = available[(index - 1 + available.length) % available.length];
    else if (event.key === 'Home') next = available[0];
    else if (event.key === 'End') next = available[available.length - 1];
    if (!next) return;
    event.preventDefault();
    setSelectedId(next.id);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-option-id="${next.id}"]`)?.focus();
  };

  return (
    <div className={styles.variants}>
      {variants && selected && (
        <>
          <div className={styles.variantLabel} id={`variants-${item.id}`}>
            {variants.label}: <strong>{selected.name}</strong>
          </div>
          <div className={styles.variantOptions} role="radiogroup" aria-labelledby={`variants-${item.id}`} onKeyDown={onOptionKey}>
            {variants.options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={option.id === selected.id}
                tabIndex={option.id === tabStop ? 0 : -1}
                data-option-id={option.id}
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
        </>
      )}
      {extras && (
        <fieldset className={styles.extras}>
          <legend className={styles.variantLabel}>
            {extras.label}
            {extras.max !== null && <span> · {extras.max === 1 ? t('elige 1') : t('hasta {count}', { count: extras.max })}</span>}
          </legend>
          <div className={styles.variantOptions}>
            {extras.options.map((extra) => {
              const checked = extraIds.includes(extra.id);
              return (
                <label key={extra.id} className={styles.extraOption} data-checked={checked || undefined} data-disabled={!extra.available || (full && !checked) || undefined}>
                  <input type="checkbox" checked={checked} disabled={!extra.available || (full && !checked)} onChange={() => toggle(extra.id)} />
                  <span>{extra.name}</span>
                  <span className={styles.extraPrice}>{extra.available ? (extra.priceLabel ? `+${extra.priceLabel}` : t('Gratis')) : t('Agotado')}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {priceText && (
        <p className={styles.variantPrice} aria-live="polite">
          {priceText}
        </p>
      )}
      {button && available && (
        <div className={styles.btnRow}>
          <AddToOrder item={line} className={button.className} variant={button.variant} hover={button.hover} label={t('Agregar al pedido')} />
        </div>
      )}
    </div>
  );
}
