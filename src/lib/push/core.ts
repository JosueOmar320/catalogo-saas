import type { Translator } from '@/i18n/translate';
import { formatPrice } from '@/lib/utils/format';

/**
 * Avisos push de pedidos nuevos. Puro: lo usan el servidor (al recibir un
 * pedido), el panel (al activar los avisos) y las pruebas.
 */

/**
 * Servicios de push de los navegadores. El servidor sólo manda avisos a
 * estos: un dispositivo "registrado" con otra URL no lo convierte en un
 * cliente HTTP hacia cualquier lado.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export type OrderPush = { reference: string; customerName: string | null; items: number; total: number | null; currency: string; partial: boolean; businessName: string };
export type PushPayload = { title: string; body: string; url: string; tag: string };

/** "Pedido nuevo #K7Q2" · "Ana · 3 productos · $96.00" (en el idioma de quien lo recibe). */
export function orderPushPayload(t: Translator, order: OrderPush, priceLocale = 'es-MX'): PushPayload {
  const parts = [
    order.customerName?.trim() || null,
    order.items === 1 ? t('1 producto') : t('{count} productos', { count: order.items }),
    order.total !== null ? `${formatPrice(Number(order.total), order.currency || 'MXN', priceLocale)}${order.partial ? ' +' : ''}` : null,
  ].filter(Boolean);
  return {
    title: t('Pedido nuevo #{reference} · {business}', { reference: order.reference, business: order.businessName }),
    body: parts.join(' · '),
    url: '/dashboard/pedidos',
    tag: `order-${order.reference}`,
  };
}

/** Clave pública VAPID (base64url) → bytes, como la pide PushManager.subscribe. */
export function vapidKeyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Nombre del dispositivo para la lista ("Chrome en Mac"), a partir del navegador. */
export function deviceLabel(userAgent: string): string {
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Navegador';
  const os = /iPhone|iPad/.test(userAgent) ? 'iPhone' : /Android/.test(userAgent) ? 'Android' : /Mac OS X/.test(userAgent) ? 'Mac' : /Windows/.test(userAgent) ? 'Windows' : /Linux/.test(userAgent) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}
