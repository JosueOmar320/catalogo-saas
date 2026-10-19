import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const isLocalSupabase = supabaseUrl?.hostname === '127.0.0.1' || supabaseUrl?.hostname === 'localhost';

/**
 * Cabeceras de seguridad para todas las rutas. La CSP es deliberadamente
 * mínima: sólo directivas que no necesitan nonces (una CSP de scripts
 * requeriría nonces en cada página y volvería dinámico el catálogo público).
 * - frame-ancestors / X-Frame-Options: evita clickjacking en /admin y /dashboard.
 * - form-action 'self': los formularios (y Server Actions) sólo envían al propio sitio.
 */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // react-pdf usa módulos nativos de Node: no se empaqueta.
  serverExternalPackages: ['@react-pdf/renderer'],
  images: {
    remotePatterns: [
      ...(supabaseUrl
        ? [
            {
              protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
              hostname: supabaseUrl.hostname,
              port: supabaseUrl.port,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
      // Fotos de la demo y de la preview de ejemplo.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    // Supabase local (supabase start) corre en 127.0.0.1.
    dangerouslyAllowLocalIP: isLocalSupabase,
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
