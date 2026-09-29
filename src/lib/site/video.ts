/**
 * Video de una sección: YouTube / Vimeo (iframe sin cookies de seguimiento
 * cuando es posible) o archivo directo .mp4/.webm. Sólo https.
 */
export type ParsedVideo =
  | { kind: 'youtube'; id: string; embed: string; thumbnail: string }
  | { kind: 'vimeo'; id: string; embed: string; thumbnail: null }
  | { kind: 'file'; src: string };

export function parseVideoUrl(raw: string, options: { autoplay?: boolean } = {}): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const auto = options.autoplay ? '&autoplay=1&mute=1' : '';
  let youtube: string | null = null;
  if (host === 'youtu.be') youtube = url.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') youtube = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
  if (youtube && /^[A-Za-z0-9_-]{6,20}$/.test(youtube)) {
    return { kind: 'youtube', id: youtube, embed: `https://www.youtube-nocookie.com/embed/${youtube}?rel=0${auto}`, thumbnail: `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` };
  }
  const vimeo = host === 'vimeo.com' || host === 'player.vimeo.com' ? url.pathname.match(/(\d{6,12})/)?.[1] : null;
  if (vimeo) return { kind: 'vimeo', id: vimeo, embed: `https://player.vimeo.com/video/${vimeo}?dnt=1${options.autoplay ? '&autoplay=1&muted=1' : ''}`, thumbnail: null };
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: 'file', src: url.toString() };
  return null;
}
