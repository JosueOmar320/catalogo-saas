import type { Metadata, Viewport } from 'next';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { COLOR_SCHEME_ATTRIBUTE, MODE_STORAGE_KEY } from '@/components/providers/color-mode';
import { env } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${env.appName} · Catálogos digitales para tu negocio`,
    template: `%s · ${env.appName}`,
  },
  description: 'Crea, personaliza y comparte el catálogo digital de tus productos y servicios. Sin código.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: el script de abajo agrega la clase light/dark al <html> antes de hidratar.
    <html lang="es" suppressHydrationWarning>
      <body>
        {/* Modo claro/oscuro de la app antes del primer pintado (sin destello). El sitio público no lo usa. */}
        <InitColorSchemeScript attribute={COLOR_SCHEME_ATTRIBUTE} modeStorageKey={MODE_STORAGE_KEY} defaultMode="system" />
        {children}
      </body>
    </html>
  );
}
