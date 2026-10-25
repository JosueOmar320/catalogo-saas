import { detectSource, type TrafficSource } from '@/lib/analytics/source';

/**
 * La visita al sitio publicado, recordada en el navegador por sesión (sólo
 * el origen y si ya vio un producto): así cada paso del recorrido se cuenta
 * una vez por visita. No se envía nada del visitante, sólo el paso y el
 * origen (contadores por día).
 */
type Visit = { source: TrafficSource; product: boolean };
type FunnelEvent = { event: 'session' | 'product' | 'add'; item?: string; start?: boolean };

const key = (slug: string) => `vitrina:visit:${slug}`;
// Sin sessionStorage (modo privado estricto): se recuerda mientras la página esté abierta.
const memory = new Map<string, Visit>();

function read(slug: string): Visit | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(key(slug)) ?? 'null') as Visit | null;
    if (raw && typeof raw.source === 'string') return { source: raw.source, product: Boolean(raw.product) };
  } catch {}
  return memory.get(slug) ?? null;
}

function write(slug: string, visit: Visit) {
  memory.set(slug, visit);
  try {
    sessionStorage.setItem(key(slug), JSON.stringify(visit));
  } catch {}
}

function send(slug: string, visit: Visit, payload: FunnelEvent) {
  try {
    navigator.sendBeacon?.('/api/funnel', new Blob([JSON.stringify({ slug, source: visit.source, ...payload })], { type: 'application/json' }));
  } catch {}
}

/** Al entrar al sitio: la primera página de la visita decide el origen y cuenta la visita. */
export function startVisit(slug: string): Visit {
  const existing = read(slug);
  if (existing) return existing;
  const visit: Visit = { source: detectSource({ search: location.search, referrer: document.referrer, host: location.host }), product: false };
  write(slug, visit);
  send(slug, visit, { event: 'session' });
  return visit;
}

/** La primera ficha de producto o servicio de la visita. */
export function markProductView(slug: string) {
  const visit = startVisit(slug);
  if (visit.product) return;
  write(slug, { ...visit, product: true });
  send(slug, visit, { event: 'product' });
}

/** Un producto nuevo en el pedido (start: era el primero del pedido). */
export function trackAddToOrder(slug: string, itemId: string | null, start: boolean) {
  send(slug, startVisit(slug), { event: 'add', ...(itemId ? { item: itemId } : {}), start });
}

/** Origen de la visita (para atribuirle el pedido enviado). */
export const visitSource = (slug: string): TrafficSource | null => read(slug)?.source ?? null;
