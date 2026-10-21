import { msg } from '@/i18n/translate';
import type { PaymentMethod } from '@/lib/catalog/settings-core';

/**
 * Nombre de cada forma de pago ("cash" → "Efectivo"). Lo comparten el mensaje
 * del pedido (sitio público) y la bandeja del panel; sin zod, para que el
 * sitio público no lo cargue. Quien lo muestra lo traduce con su t().
 */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: msg('Efectivo'),
  card: msg('Tarjeta'),
  transfer: msg('Transferencia'),
  link: msg('Enlace de pago'),
};
