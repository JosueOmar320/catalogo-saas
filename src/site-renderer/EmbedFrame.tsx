'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clampEmbedHeight, EMBED_MESSAGE, EMBED_SANDBOX, EMBED_SCROLL, EMBED_VIEWPORT } from '@/lib/site/custom-code-config';
import { embedDocument } from '@/lib/site/embed-document';
import styles from './site.module.css';

/** El contenedor que se desplaza (la vista previa del editor tiene el suyo); null = la ventana. */
function scrollRoot(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/**
 * Parte visible para el widget: desde abajo del menú fijo del sitio (si lo
 * hay) hasta el final de la ventana. `top`: cuánto del widget quedó arriba.
 */
function viewport(el: HTMLElement) {
  const root = scrollRoot(el);
  const box = root ? root.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  const header = el.closest('[data-site]')?.querySelector('header[data-sticky="true"]');
  const headerBottom = header ? header.getBoundingClientRect().bottom : box.top;
  const viewTop = Math.min(Math.max(headerBottom, box.top), box.bottom - 1);
  const frameTop = el.getBoundingClientRect().top;
  return { root, viewTop, frameTop, top: viewTop - frameTop, height: box.bottom - viewTop };
}

/**
 * iframe aislado (sandbox sin allow-same-origin: origen opaco, sin acceso a
 * la sesión ni al sitio). Sólo se aceptan mensajes de ESTE iframe y los
 * valores se limitan. Con alto automático va «en línea»: crece con su
 * contenido, la página del sitio es la que se desplaza y se le avisa qué parte
 * se ve (para su 100vh, sus ventanas fijas, sus animaciones al aparecer).
 */
export function EmbedFrame({ code, title, height, vars, fullScreen = false }: { code: string; title: string; height: number; vars?: Record<string, string>; /** Alto de la ventana, con su propio scroll. */ fullScreen?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [auto, setAuto] = useState(160);
  const inline = !fullScreen && height === 0;
  const srcDoc = useMemo(() => embedDocument(code, vars, { inline }), [code, vars, inline]);

  useEffect(() => {
    const el = frame.current;
    if (!inline || !el) return;
    let raf = 0;
    const post = () => {
      raf = 0;
      const view = viewport(el);
      el.contentWindow?.postMessage({ type: EMBED_VIEWPORT, top: Math.round(view.top), height: Math.max(1, Math.round(view.height)) }, '*');
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(post);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== el.contentWindow) return;
      if (event.data?.type === EMBED_MESSAGE) {
        const next = clampEmbedHeight(event.data.height);
        if (next !== null) setAuto(next);
        schedule();
      } else if (event.data?.type === EMBED_SCROLL && typeof event.data.top === 'number' && Number.isFinite(event.data.top)) {
        // Lleva ese punto del widget justo debajo del menú fijo del sitio.
        const view = viewport(el);
        const by = view.frameTop + event.data.top - view.viewTop;
        (view.root ?? window).scrollBy({ top: by, behavior: event.data.smooth ? 'smooth' : 'auto' });
      }
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    el.addEventListener('load', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('message', onMessage);
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      el.removeEventListener('load', schedule);
    };
  }, [inline]);

  return <iframe ref={frame} className={styles.embedFrame} title={title} srcDoc={srcDoc} sandbox={EMBED_SANDBOX} loading="lazy" referrerPolicy="no-referrer" style={{ height: fullScreen ? '100dvh' : height > 0 ? height : auto }} />;
}
