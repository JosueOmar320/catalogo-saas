'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const normalize = (path: string) => path.split('?')[0].replace(/\/$/, '') || '/';

/** Ruta actual del sitio (en la vista previa la indica el builder). */
export function useSitePath(override?: string): string {
  const pathname = usePathname();
  return normalize(override ?? pathname ?? '');
}

export const pathIn = (paths: string[], current: string) => paths.some((path) => normalize(path) === current);

/**
 * El pie de página se arma una vez en el layout (no se vuelve a renderizar
 * al navegar); las páginas que lo ocultan se resuelven aquí, por ruta.
 */
export function FooterGate({ hiddenPaths, currentPath, children }: { hiddenPaths: string[]; currentPath?: string; children: ReactNode }) {
  const current = useSitePath(currentPath);
  return pathIn(hiddenPaths, current) ? null : children;
}
