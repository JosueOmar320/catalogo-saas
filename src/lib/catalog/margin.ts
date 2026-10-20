/**
 * Margen de un producto con su costo (privado del negocio). Puro.
 *   precio 50, costo 32 → { amount: 18, percent: 36 }
 */
export type Margin = { amount: number; percent: number };

export function marginOf(price: number | null, cost: number | null): Margin | null {
  if (price === null || cost === null || !Number.isFinite(price) || !Number.isFinite(cost) || price <= 0) return null;
  const amount = Math.round((price - cost) * 100) / 100;
  // Redondeo simétrico: −12.5 % → −13 % (igual que 12.5 % → 13 %).
  const percent = (amount / price) * 100;
  return { amount, percent: Math.sign(percent) * Math.round(Math.abs(percent)) };
}
