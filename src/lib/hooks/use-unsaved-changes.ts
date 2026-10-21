'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useT } from '@/i18n/client';

/** Marca de la entrada «centinela» del historial (ver abajo). */
const GUARD = '__unsavedGuard';

const onGuard = () => Boolean(window.history.state?.[GUARD]);

/**
 * Avisa si hay cambios sin guardar:
 *  - al cerrar o recargar la pestaña (beforeunload: diálogo del navegador);
 *  - al navegar dentro de la app con un enlace (menú lateral, pestañas,
 *    botones que son <a>): se pregunta con el diálogo de confirmación y, si
 *    acepta, se navega con el router;
 *  - con Atrás/Adelante (mejor esfuerzo): mientras hay cambios se agrega una
 *    entrada «centinela» (misma URL) al historial, así el primer Atrás no
 *    sale de la página y se puede preguntar; si declina, se vuelve a poner.
 *    Sin cambios, la centinela se salta sola (un Atrás más).
 * Las navegaciones por código (router.push) no se interceptan.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  const router = useRouter();
  const confirm = useConfirm();
  const t = useT();
  // Diálogo abierto: no se pregunta dos veces.
  const asking = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    const ask = async () => {
      if (asking.current) return false;
      asking.current = true;
      try {
        return await confirm({ title: t('Tienes cambios sin guardar'), description: t('Si sales ahora se perderán.'), confirmLabel: t('Salir sin guardar'), destructive: true });
      } finally {
        asking.current = false;
      }
    };

    // Enlaces internos (mismo origen, sin modificadores, sin target ni download): se pregunta antes.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Misma página (p. ej. un ancla #): no se sale de ningún lado.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // Next Link respeta defaultPrevented: no navega.
      event.preventDefault();
      void ask().then((ok) => {
        if (!ok) return;
        // replace: la entrada centinela (misma URL) se reemplaza por el destino, sin dejar rastro.
        if (onGuard()) router.replace(url.pathname + url.search + url.hash);
        else router.push(url.pathname + url.search + url.hash);
      });
    };

    const pushGuard = () => window.history.pushState({ ...(window.history.state ?? {}), [GUARD]: true }, '', window.location.href);
    let wasOnGuard = onGuard();
    let leaving = false;
    const onPopState = () => {
      const fromGuard = wasOnGuard;
      wasOnGuard = onGuard();
      if (leaving || !fromGuard || wasOnGuard) return;
      if (!dirty) {
        // Ya se guardó: la centinela se salta sola para que el Atrás del usuario llegue a donde iba.
        leaving = true;
        window.history.back();
        return;
      }
      void ask().then((ok) => {
        if (ok) {
          // La centinela ya se sacó: falta salir de la entrada original.
          leaving = true;
          window.history.back();
          // Si no había a dónde ir (pestaña abierta directo aquí), se vuelve a escuchar.
          window.setTimeout(() => {
            leaving = false;
          }, 1000);
        } else {
          pushGuard();
          wasOnGuard = true;
        }
      });
    };

    if (dirty && !wasOnGuard) {
      pushGuard();
      wasOnGuard = true;
    }
    if (dirty) document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, [dirty, confirm, router, t]);
}
