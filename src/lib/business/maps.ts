/**
 * Mapa de Google sin clave de API: `https://www.google.com/maps?q=…&output=embed`.
 * Los enlaces que copia el usuario ("Compartir" → maps.app.goo.gl/…, o la URL
 * de /maps/place/…) no se pueden poner en un iframe: se convierten aquí en una
 * ubicación (coordenadas del pin o, si no hay, el nombre del lugar).
 */

/** Hosts de Google Maps aceptados (enlaces cortos y completos). */
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
const MAPS_HOST = /^(www\.|maps\.)?google\.[a-z.]{2,6}$/;

const coord = (lat: string, lng: string) => {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? `${a},${b}` : null;
};

function parse(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

/** Enlace corto de "Compartir" (hay que seguir la redirección en el servidor para leer la ubicación). */
export function isShortMapsUrl(raw: string): boolean {
  const url = parse(raw);
  return Boolean(url && SHORT_HOSTS.has(url.hostname) && (url.hostname !== 'goo.gl' || url.pathname.startsWith('/maps')));
}

/** URL de Google Maps (no corta). */
export function isGoogleMapsUrl(raw: string): boolean {
  const url = parse(raw);
  return Boolean(url && MAPS_HOST.test(url.hostname) && (url.hostname.startsWith('maps.') || url.pathname.startsWith('/maps')));
}

/**
 * Ubicación de una URL completa de Google Maps. Prioridad: el pin exacto
 * (`!3d<lat>!4d<lng>`), el parámetro `q`/`query`, el centro de la vista
 * (`@lat,lng`) y por último el nombre del lugar (`/place/<nombre>/`).
 */
export function mapsLocationFromUrl(raw: string): string | null {
  if (!isGoogleMapsUrl(raw)) return null;
  const url = parse(raw)!;
  const full = decodeURIComponent(url.pathname + url.search);
  const pin = full.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return coord(pin[1], pin[2]);
  const query = url.searchParams.get('q') ?? url.searchParams.get('query');
  if (query?.trim()) return query.trim().slice(0, 120);
  const at = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return coord(at[1], at[2]);
  const place = url.pathname.match(/\/place\/([^/]+)/);
  if (place) return decodeURIComponent(place[1]).replace(/\+/g, ' ').trim().slice(0, 120) || null;
  return null;
}

/** `src` del iframe del mapa: ubicación del enlace de Maps o, si no hay, la dirección escrita. */
export function mapEmbedSrc(contact: { mapsLocation?: string; mapsUrl?: string; address?: string; city?: string }): string | null {
  const location = contact.mapsLocation || (contact.mapsUrl ? mapsLocationFromUrl(contact.mapsUrl) : null) || [contact.address, contact.city].filter(Boolean).join(', ');
  if (!location) return null;
  const zoom = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(location) ? '&z=16' : '';
  return `https://www.google.com/maps?q=${encodeURIComponent(location)}${zoom}&output=embed`;
}
