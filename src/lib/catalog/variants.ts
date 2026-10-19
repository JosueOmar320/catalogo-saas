import type { ItemVariants, VariantOption } from './item-attributes';

/** Precio de una opción: el suyo, o el del producto si no tiene. */
export const optionPrice = (option: Pick<VariantOption, 'price'>, basePrice: number | null) => option.price ?? basePrice;

/**
 * Precio que se muestra en tarjetas, listados y PDF para un producto con
 * opciones: el menor de las opciones disponibles (o de todas, si ninguna lo
 * está), con "desde" cuando no todas cuestan lo mismo.
 */
export function variantPriceSummary(basePrice: number | null, variants: ItemVariants | null): { price: number | null; from: boolean } {
  if (!variants) return { price: basePrice, from: false };
  const pool = variants.options.some((o) => o.available) ? variants.options.filter((o) => o.available) : variants.options;
  const prices = pool.map((o) => optionPrice(o, basePrice)).filter((p): p is number => p !== null && Number.isFinite(p));
  if (prices.length === 0) return { price: basePrice, from: false };
  const min = Math.min(...prices);
  return { price: min, from: new Set(variants.options.map((o) => optionPrice(o, basePrice))).size > 1 };
}

/** Disponible si el producto lo está y al menos una opción también. */
export const hasAvailableOption = (variants: ItemVariants | null) => !variants || variants.options.some((o) => o.available);
