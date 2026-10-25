import { NextResponse, type NextRequest } from 'next/server';
import { routeCustomDomain } from '@/lib/domains/routing';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Rutas que necesitan la sesión. El catálogo público queda fuera para que sea
 * cacheable, y los avisos anónimos del sitio publicado (/api/orders,
 * /api/views, /api/reviews, /api/search-misses), /api/health, /api/cron/* y
 * /api/email/* no la usan: refrescarla ahí sería una llamada a Auth por cada
 * visita. Las rutas de API con sesión se listan una por una
 * (/api/orders/export sí, /api/orders no).
 */
const SESSION_PREFIXES = ['/dashboard', '/admin', '/preview', '/api/assistant', '/api/catalogs', '/api/catalog'];
const SESSION_PATHS = new Set(['/cuenta', '/sin-acceso', '/login', '/api/orders/export', '/api/stats/export']);
const needsSession = (pathname: string) => SESSION_PATHS.has(pathname) || SESSION_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function proxy(request: NextRequest) {
  // 1) Un dominio propio de un negocio: su sitio (no hay sesión que refrescar).
  const custom = await routeCustomDomain(request);
  if (custom) return custom;
  const { pathname } = request.nextUrl;
  // 2) /dominio/<negocio> sólo se llega reescrito desde un dominio propio (en la plataforma, duplicaría /catalogo).
  if (pathname === '/dominio' || pathname.startsWith('/dominio/')) return new NextResponse('Not found', { status: 404 });
  if (needsSession(pathname)) return updateSession(request);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Rutas con sesión (en cualquier host).
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
    // /dominio directo en la plataforma: 404.
    '/dominio',
    '/dominio/:path*',
    // Cualquier otra ruta sólo en hosts que no son de la plataforma (los dominios propios): en
    // localhost y *.vercel.app el proxy no corre para el catálogo público, como antes.
    // Si la plataforma estrena un dominio propio, agrégalo aquí también.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [{ type: 'host', value: '(?:localhost|127\\.0\\.0\\.1|(?:.+\\.)?vercel\\.app)' }],
    },
  ],
};
