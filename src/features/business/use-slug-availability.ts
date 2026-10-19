'use client';

import { useEffect, useState } from 'react';
import { BUSINESS_SLUG_PATTERN } from '@/lib/utils/slug';
import { checkSlugAvailability } from './actions';

export type SlugStatus = 'idle' | 'checking' | 'ok' | 'taken';

export const SLUG_STATUS_TEXT: Record<SlugStatus, string> = {
  idle: 'Letras minúsculas, números y guiones.',
  checking: 'Verificando…',
  ok: '¡Disponible!',
  taken: 'Esa dirección ya está en uso.',
};

/** Verifica (con debounce) si una dirección de catálogo está libre. */
export function useSlugAvailability(slug: string, currentSlug?: string): SlugStatus {
  const [result, setResult] = useState<{ slug: string; available: boolean | null } | null>(null);
  const shouldCheck = BUSINESS_SLUG_PATTERN.test(slug) && slug !== currentSlug;

  useEffect(() => {
    if (!shouldCheck) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      // Si la verificación falla (sin conexión), no se afirma nada: la base valida al guardar.
      const available = await checkSlugAvailability(slug).then((r) => (r.ok ? r.data.available : null)).catch(() => null);
      if (!cancelled) setResult({ slug, available });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, shouldCheck]);

  if (!shouldCheck) return 'idle';
  if (result?.slug !== slug) return 'checking';
  if (result.available === null) return 'idle';
  return result.available ? 'ok' : 'taken';
}
