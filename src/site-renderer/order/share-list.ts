import { clampQty, MAX_ORDER_LINES, type OrderLine } from './message';

/**
 * "Compartir mi lista": el pedido viaja en el enlace (?lista=…) como
 * [línea, cantidad, nombre] en base64url. Quien lo abre lo agrega a su propio
 * pedido; los precios y lo que ya no se puede pedir se toman del catálogo de
 * ese momento (refreshLines). Nada pasa por el servidor.
 */
export const LIST_PARAM = 'lista';

type Entry = [id: string, qty: number, name: string];

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
};

export function encodeList(lines: Pick<OrderLine, 'id' | 'qty' | 'name'>[]): string {
  const entries: Entry[] = lines.slice(0, MAX_ORDER_LINES).map((line) => [line.id, line.qty, line.name.slice(0, 80)]);
  return toBase64Url(JSON.stringify(entries));
}

/** Lo que viene en el enlace, validado; null si no es una lista válida. */
export function decodeList(value: string | null, pricing: { currency: string }, siteUrl: string): OrderLine[] | null {
  if (!value || value.length > 8000) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(value));
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const lines = raw.slice(0, MAX_ORDER_LINES).flatMap((entry): OrderLine[] => {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[2] !== 'string') return [];
    const id = entry[0].slice(0, 120);
    const qty = clampQty(Number(entry[1]));
    const name = entry[2].trim().slice(0, 200);
    if (!/^[\w-]+([:+][\w-]+)*$/.test(id) || qty < 1 || !name) return [];
    return [{ id, itemId: id.split(/[:+]/)[0], name, sku: null, price: null, priceLabel: null, currency: pricing.currency, url: siteUrl, image: null, qty }];
  });
  return lines.length ? lines : null;
}

/** Junta la lista recibida con el pedido actual: misma línea → se suman las cantidades. */
export function mergeLines(current: OrderLine[], incoming: OrderLine[]): OrderLine[] {
  const merged = current.map((line) => {
    const extra = incoming.find((other) => other.id === line.id);
    return extra ? { ...line, qty: clampQty(line.qty + extra.qty) } : line;
  });
  const added = incoming.filter((line) => !current.some((other) => other.id === line.id));
  return [...merged, ...added].slice(0, MAX_ORDER_LINES);
}
