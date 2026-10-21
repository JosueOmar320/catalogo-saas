'use client';

import { useEffect, useRef } from 'react';
import { installFx } from '@/lib/site/fx';
import styles from './site.module.css';

/**
 * HTML propio ya limpio, con su CSS limitado a la sección y los efectos
 * (data-fx: inclinación 3D, luz que sigue al mouse, contadores). El script es
 * de la plataforma: el HTML del negocio no ejecuta nada.
 */
export function CustomHtml({ id, html, css }: { id: string; html: string; css: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return installFx(ref.current);
  }, [html]);
  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div ref={ref} className={styles.customHtml} data-custom-html={id} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
