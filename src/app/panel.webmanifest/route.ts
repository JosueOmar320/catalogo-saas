import { env } from '@/lib/env';

/**
 * Manifest del panel: se puede instalar como app (pantalla de inicio) y, en
 * iPhone, así recibe los avisos de pedidos. Sólo cubre /dashboard.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    {
      name: `${env.appName} · Panel`,
      short_name: env.appName,
      description: 'Pedidos, catálogo y sitio de tu negocio.',
      id: '/dashboard',
      start_url: '/dashboard',
      scope: '/dashboard',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#18181B',
      icons: [
        { src: '/panel-icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
