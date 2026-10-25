import { msg } from '@/i18n/translate';

/**
 * De dónde llegó un visitante al sitio publicado. Se decide una vez por
 * visita (sesión del navegador) con el enlace (?ref=…, utm_source, ?mesa,
 * ?opinar) o, si no lo dice, con la página anterior (document.referrer).
 * Puro y sin dependencias: lo usa el sitio público (cliente) y el panel.
 */
export const TRAFFIC_SOURCES = ['direct', 'instagram', 'facebook', 'whatsapp', 'tiktok', 'google', 'search', 'x', 'qr', 'reviews', 'email', 'referral', 'other'] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

export const SOURCE_LABELS: Record<TrafficSource, string> = {
  direct: msg('Directo'),
  instagram: msg('Instagram'),
  facebook: msg('Facebook'),
  whatsapp: msg('WhatsApp'),
  tiktok: msg('TikTok'),
  google: msg('Google'),
  search: msg('Otros buscadores'),
  x: msg('X (Twitter)'),
  qr: msg('Código QR'),
  reviews: msg('Enlace de reseñas'),
  email: msg('Correo'),
  referral: msg('Otros sitios'),
  other: msg('Otros'),
};

/** Valores de ?ref= / utm_source que se reconocen (en minúsculas). */
const REF_ALIASES: Record<string, TrafficSource> = {
  ig: 'instagram', instagram: 'instagram', fb: 'facebook', facebook: 'facebook', meta: 'facebook',
  wa: 'whatsapp', whatsapp: 'whatsapp', tiktok: 'tiktok', tt: 'tiktok', google: 'google', gmb: 'google',
  qr: 'qr', flyer: 'qr', volante: 'qr', email: 'email', correo: 'email', newsletter: 'email', mail: 'email',
  x: 'x', twitter: 'x', resenas: 'reviews', reviews: 'reviews',
};

/** Sitios que se reconocen por la página de la que viene el visitante. */
const REFERRERS: [RegExp, TrafficSource][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com|messenger\.com)$/, 'facebook'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|search\.brave\.com)$/, 'search'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com)$/, 'email'],
];

/** Enlace con seguimiento: ?ref=<origen> (lo que el negocio pega en su bio, volantes o mensajes). */
export const trackedLink = (url: string, ref: string) => `${url}${url.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;

export function detectSource({ search, referrer, host }: { search: string; referrer: string; host: string }): TrafficSource {
  const params = new URLSearchParams(search);
  const ref = (params.get('ref') ?? params.get('utm_source') ?? '').trim().toLowerCase();
  if (ref) return REF_ALIASES[ref] ?? 'other';
  if (params.has('mesa')) return 'qr';
  if (params.has('opinar')) return 'reviews';
  if (!referrer) return 'direct';
  let from: URL;
  try {
    from = new URL(referrer);
  } catch {
    return 'direct';
  }
  // Navegar dentro del mismo sitio no es una llegada nueva.
  if (from.host === host) return 'direct';
  return REFERRERS.find(([pattern]) => pattern.test(from.hostname.toLowerCase()))?.[1] ?? 'referral';
}
