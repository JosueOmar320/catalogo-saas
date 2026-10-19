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

function round(value: number, rounding: PriceRounding): number {
  switch (rounding) {
    case 'unit':
      return Math.round(value);
    case 'ten':
      return Math.round(value / 10) * 10;
    case 'nine': {
      // Termina en 9 (49, 99, 149): el más cercano; nunca baja de 9.
      const nine = Math.round((value + 1) / 10) * 10 - 1;
      return Math.max(9, nine);
    }
    default:
      return Math.round(value * 100) / 100;
  }
}

/** Precio nuevo, o null si el ítem no tiene precio (se deja sin cambios). Nunca negativo. */
export function adjustPrice(price: number | null, adjustment: PriceAdjustment): number | null {
  if (price === null || !Number.isFinite(price)) return null;
  const raw = adjustment.mode === 'percent' ? price * (1 + adjustment.value / 100) : price + adjustment.value;
  return Math.max(0, round(raw, adjustment.rounding));
}

export function isValidAdjustment(adjustment: PriceAdjustment): boolean {
  if (!Number.isFinite(adjustment.value) || adjustment.value === 0) return false;
  if (adjustment.mode === 'percent') return adjustment.value >= MIN_PERCENT && adjustment.value <= MAX_PERCENT;
  return Math.abs(adjustment.value) <= 1_000_000;
}
