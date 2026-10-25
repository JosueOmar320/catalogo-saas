'use client';

import { useEffect } from 'react';

const POLL_MS = 60_000;
const PREFIX = /^\(\d+\+?\) /;

/** "(3) Pedidos · Vitrina": pedidos nuevos en el título de la pestaña del panel (se revisa cada minuto). */
export function NewOrdersTitle() {
  useEffect(() => {
    let count = 0;
    const apply = () => {
      const base = document.title.replace(PREFIX, '');
      const next = count > 0 ? `(${count > 99 ? '99+' : count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    // Al navegar, Next cambia el título: se vuelve a poner el contador.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    const tick = async () => {
      try {
        const response = await fetch('/api/orders/new-count', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { count?: number };
        count = typeof data.count === 'number' ? data.count : 0;
        apply();
      } catch {}
    };
    void tick();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void tick();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      observer.disconnect();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      count = 0;
      apply();
    };
  }, []);
  return null;
}
