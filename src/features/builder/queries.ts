import 'server-only';
import type { BusinessContext } from '@/lib/auth/session';
import { buildSampleSite } from '@/lib/site/sample-site';
import { parseSections, type Section } from '@/lib/site/section-schemas';
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
  sectionTemplates: SectionTemplate[];
  /** Versión del sitio cargada (site_version): el guardado la envía para detectar cambios de otra persona. */
  version: string | null;
};

/** Sección guardada por el negocio para reusarla ("Mis plantillas"). */
export type SectionTemplate = { id: string; name: string; section: Section };

export function toSectionTemplate(row: { id: string; name: string; section: unknown }): SectionTemplate | null {
  const [section] = parseSections([row.section]);
  return section ? { id: row.id, name: row.name, section } : null;
}

async function listSectionTemplates(ctx: BusinessContext): Promise<SectionTemplate[]> {
  const { data } = await ctx.supabase.from('section_templates').select('id, name, section').eq('business_id', ctx.business.id).order('created_at', { ascending: false }).limit(50);
  return (data ?? []).flatMap((row) => toSectionTemplate(row) ?? []);
}

/**
 * Datos del builder: el sitio con TODAS las páginas (publicadas o no) y los
 * ítems visibles. Si el catálogo está vacío, la preview usa ítems de ejemplo.
 */
export async function getBuilderData(ctx: BusinessContext): Promise<BuilderData> {
  const [loaded, sectionTemplates, version] = await Promise.all([getSiteForAdmin(ctx), listSectionTemplates(ctx), getSiteVersion(ctx)]);
  let site = loaded;
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

  return { site, persistedPageIds: pages.map((p) => p.id), isStarter, usesSampleItems, sectionTemplates, version };
}

/** Versión actual del sitio (null si no se pudo leer: el guardado entonces no verifica). */
export async function getSiteVersion(ctx: BusinessContext): Promise<string | null> {
  const { data, error } = await ctx.supabase.rpc('site_version', { p_catalog_id: ctx.catalog.id });
  return error || typeof data !== 'string' ? null : data;
}
