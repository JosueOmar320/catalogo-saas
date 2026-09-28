import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const isLocalSupabase = supabaseUrl?.hostname === '127.0.0.1' || supabaseUrl?.hostname === 'localhost';

const nextConfig: NextConfig = {
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
