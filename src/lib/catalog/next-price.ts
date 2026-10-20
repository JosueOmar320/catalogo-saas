import { todayIn } from './sale';

/**
 * Precio programado: "desde el 1 de noviembre cuesta $55". El día llega en la
 * zona horaria de quien lo programó y el sitio, el pedido y el PDF usan el
 * nuevo precio sin que nadie lo cambie a mano; al editar el producto, el
 * nuevo precio pasa a ser el precio guardado. Puro.
 */
export type NextPrice = { on: string; price: number; timeZone: string };

/** ¿Ya empezó a valer? */
export const nextPriceStarted = (next: NextPrice | null, now: Date) => Boolean(next && todayIn(next.timeZone, now) >= next.on);

/** El precio que vale hoy: el programado si ya empezó, si no el guardado. */
export const effectivePrice = (price: number | null, next: NextPrice | null, now: Date) => (next && nextPriceStarted(next, now) ? next.price : price);
