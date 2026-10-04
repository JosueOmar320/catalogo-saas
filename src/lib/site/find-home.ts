import type { SitePage } from './pages';

/** Página de inicio (o la primera). Sin zod: se usa en el navegador. */
export function findHome(pages: SitePage[]): SitePage | undefined {
  return pages.find((p) => p.isHome) ?? pages[0];
}
