import type { Metadata, Viewport } from 'next';
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
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
