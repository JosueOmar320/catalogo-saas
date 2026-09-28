import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { buildSampleSite } from '@/lib/site/sample-site';
import { buildStarterSite } from '@/lib/site/starter';
import type { SiteViewModel } from '@/lib/site/view-model';
import { getSiteForAdmin } from '@/features/catalog/queries';

export type BuilderData = {
  site: SiteViewModel;
  /** Ids de páginas ya guardadas (para saber qué borrar). */
  persistedPageIds: string[];
  /** El catálogo no tenía páginas: se propone un sitio inicial sin guardar. */
  isStarter: boolean;
  /** Se muestran ítems de ejemplo porque el catálogo está vacío. */
  usesSampleItems: boolean;
};

/**
 * Datos del builder: el sitio con TODAS las páginas (publicadas o no) y los
 * ítems visibles. Si el catálogo está vacío, la preview usa ítems de ejemplo.
 */
export async function getBuilderData(ctx: BusinessContext): Promise<BuilderData> {
  let site = await getSiteForAdmin(ctx);
  const pages = site.pages;

  // Defensa: catálogos sin páginas (p. ej. creados antes de la migración de datos).
  const isStarter = pages.length === 0;
  const starter = isStarter ? buildStarterSite('both') : null;
  site = { ...site, pages: starter ? starter.pages : pages, navigation: starter && site.navigation.items.length === 0 ? starter.navigation : site.navigation };

  const usesSampleItems = site.items.length === 0;
  if (usesSampleItems) {
    const sample = buildSampleSite();
    site = { ...site, items: sample.items, categories: sample.categories };
  }

  return { site, persistedPageIds: pages.map((p) => p.id), isStarter, usesSampleItems };
}
