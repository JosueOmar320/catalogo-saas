import type { Translator } from '@/i18n/translate';

/** Mensaje para pedir una reseña (tarjeta "Pide reseñas" y pedidos entregados). */
export const reviewInviteMessage = (t: Translator, businessName: string, url: string) =>
  t('¡Gracias por tu compra en {business}! ¿Nos dejas tu opinión? Te toma un minuto: {url}', { business: businessName, url });
