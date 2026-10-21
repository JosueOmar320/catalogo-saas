import type { ItemAttributes } from './item-attributes';

/**
 * Ajuste masivo de precios (panel → Productos → seleccionar → Ajustar precios).
 * Puro para probarlo y para la vista previa en el navegador, que usa la misma
 * función que el servidor.
 */
export const PRICE_ROUNDINGS = ['none', 'unit', 'ten', 'nine'] as const;
export type PriceRounding = (typeof PRICE_ROUNDINGS)[number];

export type PriceAdjustment = {
  /** percent: +10 sube 10 %, -15 baja 15 %. amount: suma o resta un monto fijo. */
  mode: 'percent' | 'amount';
  value: number;
  rounding: PriceRounding;
};

export const MIN_PERCENT = -90;
export const MAX_PERCENT = 500;

const cents = (value: number) => Math.round(value * 100) / 100;

function round(value: number, rounding: PriceRounding): number {
  switch (rounding) {
    case 'unit':
      return Math.round(value);
    case 'ten':
      return Math.round(value / 10) * 10;
    case 'nine':
      // Termina en 9 (49, 99, 149): el más cercano. Por debajo de 9 no hay
      // "terminado en 9" razonable: queda el valor tal cual (una rebaja de $5
      // no puede subirlo a $9).
      return value < 9 ? cents(value) : Math.round((value + 1) / 10) * 10 - 1;
    default:
      return cents(value);
  }
}

/**
 * Precio nuevo, o null si el ítem no tiene precio (se deja sin cambios). Nunca
 * negativo, y el redondeo nunca invierte el sentido del ajuste: una rebaja no
 * deja un precio mayor que el original ni una subida uno menor.
 */
export function adjustPrice(price: number | null, adjustment: PriceAdjustment): number | null {
  if (price === null || !Number.isFinite(price)) return null;
  const raw = adjustment.mode === 'percent' ? price * (1 + adjustment.value / 100) : price + adjustment.value;
  const rounded = Math.max(0, round(raw, adjustment.rounding));
  if (adjustment.value < 0) return Math.min(rounded, price);
  if (adjustment.value > 0) return Math.max(rounded, price);
  return rounded;
}

export function isValidAdjustment(adjustment: PriceAdjustment): boolean {
  if (!Number.isFinite(adjustment.value) || adjustment.value === 0) return false;
  if (adjustment.mode === 'percent') return adjustment.value >= MIN_PERCENT && adjustment.value <= MAX_PERCENT;
  return Math.abs(adjustment.value) <= 1_000_000;
}

/* ------------------------------------------------------- Ítem completo */

/** Los precios de un ítem que el ajuste masivo toca: el base, el anterior y los que viven en attributes. */
export type AdjustableItem = {
  price: number | null;
  compareAtPrice: number | null;
  attributes: Pick<ItemAttributes, 'variants' | 'tiers' | 'nextPrice'>;
};

/**
 * Aplica el mismo ajuste a todos los precios del ítem: el precio, el precio
 * anterior (que se quita si deja de ser mayor), el de cada opción que tenga
 * el suyo, los precios por mayoreo y el precio programado. Devuelve null si
 * el ítem no tiene ningún precio que ajustar.
 */
export function adjustItemPrices(item: AdjustableItem, adjustment: PriceAdjustment): AdjustableItem | null {
  const { variants, tiers, nextPrice } = item.attributes;
  const hasAny = item.price !== null || Boolean(variants?.options.some((o) => o.price !== null)) || tiers.length > 0 || nextPrice !== null;
  if (!hasAny) return null;
  const price = adjustPrice(item.price, adjustment);
  const compare = adjustPrice(item.compareAtPrice, adjustment);
  return {
    price,
    // Un "precio anterior" que ya no es mayor que el nuevo dejaría de ser una oferta.
    compareAtPrice: compare !== null && price !== null && compare > price ? compare : null,
    attributes: {
      variants: variants && { ...variants, options: variants.options.map((o) => ({ ...o, price: adjustPrice(o.price, adjustment) })) },
      tiers: tiers.map((tier) => ({ ...tier, price: adjustPrice(tier.price, adjustment) ?? tier.price })),
      nextPrice: nextPrice && { ...nextPrice, price: adjustPrice(nextPrice.price, adjustment) ?? nextPrice.price },
    },
  };
}
