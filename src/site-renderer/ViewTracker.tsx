'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Cuenta las páginas vistas del sitio publicado (sólo el publicado: la demo y
 * las vistas previas no lo montan). Envía el negocio y, en una ficha, el slug
 * del ítem; nada del visitante. sendBeacon no bloquea la navegación.
 */
export function ViewTracker({ slug }: { slug: string }) {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    const base = `/catalogo/${slug}`;
    const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
    const item = /^\/p\/([a-z0-9-]+)\/?$/.exec(rest)?.[1] ?? null;
    try {
      navigator.sendBeacon?.('/api/views', new Blob([JSON.stringify({ slug, item })], { type: 'application/json' }));
    } catch {}
  }, [pathname, slug]);

  return null;
}
