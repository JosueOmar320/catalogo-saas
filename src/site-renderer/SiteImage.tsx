import Image from 'next/image';
import { env } from '@/lib/env';

type Props = { src: string; alt: string; sizes: string; className?: string; priority?: boolean };

const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;

/** Sólo el Storage propio (y las fotos de la demo) pasan por el optimizador: las URLs externas se muestran tal cual. */
export function optimizable(src: string): boolean {
  if (!env.imageOptimization) return false;
  if (src.startsWith('/')) return true;
  try {
    const url = new URL(src);
    return url.origin === storageOrigin || url.hostname === 'images.unsplash.com';
  } catch {
    return false;
  }
}

/** Imagen del sitio (llena su contenedor). AVIF/WebP responsive salvo NEXT_PUBLIC_IMAGE_OPTIMIZATION=false o URL externa. */
export function SiteImage({ src, alt, sizes, className, priority }: Props) {
  return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} unoptimized={!optimizable(src)} />;
}
