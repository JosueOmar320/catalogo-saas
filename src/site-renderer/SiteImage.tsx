import Image from 'next/image';
import { env } from '@/lib/env';

type Props = { src: string; alt: string; sizes: string; className?: string; priority?: boolean };

/** Imagen del sitio (llena su contenedor). Optimizada salvo NEXT_PUBLIC_IMAGE_OPTIMIZATION=false. */
export function SiteImage({ src, alt, sizes, className, priority }: Props) {
  return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} unoptimized={!env.imageOptimization} />;
}
