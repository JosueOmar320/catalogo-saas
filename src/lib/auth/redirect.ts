const BASE = 'http://internal.invalid';

/**
 * Destino interno seguro para "?next=" después de iniciar sesión (evita open
 * redirects). Se resuelve contra un origen ficticio y sólo se acepta si sigue
 * en ese origen: así se rechazan "//evil.com", "/\evil.com" (los navegadores
 * tratan "\" como "/") y variantes con tabs o saltos de línea, que el parser
 * de URLs elimina.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/')) return null;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE || url.pathname.startsWith('//')) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
