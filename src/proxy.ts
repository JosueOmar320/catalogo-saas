import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Sólo rutas que necesitan sesión. El catálogo público queda fuera para que sea cacheable,
  // y los avisos anónimos del sitio publicado (/api/orders, /api/views, /api/reviews,
  // /api/search-misses), /api/health, /api/cron/* y /api/email/* no la usan: refrescarla
  // ahí sería una llamada a Auth por cada visita. Las rutas de API con sesión se listan una
  // por una (/api/orders/export sí, /api/orders no).
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/cuenta',
    '/sin-acceso',
    '/preview',
    '/preview/:path*',
    '/login',
    '/api/assistant/:path*',
    '/api/catalogs/:path*',
    '/api/catalog/:path*',
    '/api/orders/export',
    '/api/stats/export',
  ],
};
