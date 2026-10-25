'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clampEmbedHeight, EMBED_MESSAGE, EMBED_SANDBOX } from '@/lib/site/custom-code-config';
import { embedDocument } from '@/lib/site/embed-document';
import styles from './site.module.css';

/**
 * iframe aislado (sandbox sin allow-same-origin: origen opaco, sin acceso a
 * la sesión ni al sitio). Con alto automático, sólo se aceptan mensajes de
 * ESTE iframe y el valor se limita.
 */
export function EmbedFrame({ code, title, height, vars, fullScreen = false }: { code: string; title: string; height: number; vars?: Record<string, string>; /** Alto de la ventana, con su propio scroll. */ fullScreen?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [auto, setAuto] = useState(160);
  const srcDoc = useMemo(() => embedDocument(code, vars), [code, vars]);

  useEffect(() => {
    if (height > 0 || fullScreen) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== EMBED_MESSAGE) return;
      const next = clampEmbedHeight(event.data.height);
      if (next !== null) setAuto(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [height, fullScreen]);

  return <iframe ref={frame} className={styles.embedFrame} title={title} srcDoc={srcDoc} sandbox={EMBED_SANDBOX} loading="lazy" referrerPolicy="no-referrer" style={{ height: fullScreen ? '100dvh' : height > 0 ? height : auto }} />;
}
