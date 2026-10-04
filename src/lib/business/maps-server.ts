import { isGoogleMapsUrl, isShortMapsUrl, mapsLocationFromUrl } from './maps';

const MAX_HOPS = 4;
const TIMEOUT_MS = 5000;

/**
 * Ubicación de un enlace de Google Maps, siguiendo el enlace corto
 * (maps.app.goo.gl) en el servidor. Sólo sigue redirecciones hacia hosts de
 * Google (nada de URLs arbitrarias: sin SSRF) y no descarga el cuerpo.
 * Si algo falla devuelve null y el mapa usa la dirección escrita.
 */
export async function resolveMapsLocation(raw: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  if (!raw) return null;
  if (!isShortMapsUrl(raw)) return mapsLocationFromUrl(raw);
  let current = raw;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let response: Response;
    try {
      response = await fetcher(current, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': 'Mozilla/5.0 (compatible; Vitrina)' } });
    } catch {
      return null;
    }
    await response.body?.cancel().catch(() => undefined);
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return null;
    const next = new URL(location, current).toString();
    if (isGoogleMapsUrl(next)) return mapsLocationFromUrl(next);
    if (!isShortMapsUrl(next)) return null;
    current = next;
  }
  return null;
}
