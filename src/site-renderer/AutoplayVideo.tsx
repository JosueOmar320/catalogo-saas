'use client';

import { useEffect, useRef } from 'react';

/**
 * Video de archivo que arranca solo (silenciado, en bucle). Respeta
 * «reducir movimiento»: con esa preferencia no arranca y muestra los
 * controles; si el navegador bloquea el autoplay, también.
 */
export function AutoplayVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.controls = true;
      return;
    }
    video.play().catch(() => {
      video.controls = true;
    });
  }, [src]);
  return <video ref={ref} src={src} muted loop playsInline preload="metadata" disablePictureInPicture />;
}
