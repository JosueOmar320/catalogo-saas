import { NextResponse, type NextRequest } from 'next/server';
import { env, isSupabaseConfigured } from '@/lib/env';
import { isPlatformHost } from './domain';

/**
 * Visitas a un dominio propio (mitienda.com/menu): el proxy las reescribe a
 * /dominio/<negocio>/menu. La dirección del navegador no cambia y la página
 * sale del mismo caché que /catalogo/<negocio>.
 */

/** Rutas que nunca son del sitio del negocio: API, archivos de Next, imágenes generadas. */
const PASS_THROUGH = /^\/(api|_next|og|\.well-known|monitoring)(\/|$)/;
/** Archivos con extensión (íconos, manifest…) salvo los del propio dominio. */
const FILE = /\.[a-z0-9]{2,8}$/i;
const DOMAIN_FILES = new Set(['/robots.txt', '/sitemap.xml']);

const platformHosts = [env.siteUrl, process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL]
  .flatMap((value) => {
    if (!value) return [];
    try {
      return [new URL(value.includes('://') ? value : `https://${value}`).hostname];
    } catch {
      return [];
    }
  });

/** Caché por instancia: un dominio activo se consulta a la base una vez por minuto (los que no existen, cada 30 s). */
const cache = new Map<string, { slug: string | null; expires: number }>();
const MAX_CACHE = 500;

async function slugForHost(host: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.expires > now) return hit.slug;
  try {
    const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/get_site_by_domain`, {
      method: 'POST',
      headers: { apikey: env.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_host: host }),
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (!response.ok) return hit?.slug ?? null;
    const slug = (await response.json()) as string | null;
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(host, { slug: typeof slug === 'string' ? slug : null, expires: now + (slug ? 60_000 : 30_000) });
    return typeof slug === 'string' ? slug : null;
  } catch {
    // Base lenta o caída: se usa lo último que se supo.
    return hit?.slug ?? null;
  }
}

/** La respuesta para un dominio propio, o null si la visita es a la plataforma. */
export async function routeCustomDomain(request: NextRequest): Promise<NextResponse | null> {
  const host = (request.headers.get('host') ?? '').toLowerCase().replace(/:\d+$/, '');
  if (!host || !isSupabaseConfigured || isPlatformHost(host, platformHosts)) return null;
  const { pathname } = request.nextUrl;
  if (PASS_THROUGH.test(pathname) || (FILE.test(pathname) && !DOMAIN_FILES.has(pathname))) return NextResponse.next();
  const slug = await slugForHost(host);
  const url = request.nextUrl.clone();
  // Un dominio que no es de ningún negocio activo: la página de «no disponible».
  url.pathname = slug ? `/dominio/${slug}${pathname === '/' ? '' : pathname}` : '/dominio/-';
  return NextResponse.rewrite(url);
}
