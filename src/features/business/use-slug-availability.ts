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
  const [result, setResult] = useState<{ slug: string; available: boolean } | null>(null);
  const shouldCheck = BUSINESS_SLUG_PATTERN.test(slug) && slug !== currentSlug;

  useEffect(() => {
    if (!shouldCheck) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await checkSlugAvailability(slug);
      if (!cancelled) setResult({ slug, available: response.ok && response.data.available });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, shouldCheck]);

  if (!shouldCheck) return 'idle';
  if (result?.slug !== slug) return 'checking';
  return result.available ? 'ok' : 'taken';
}
