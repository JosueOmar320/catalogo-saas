import type { LinkContext } from '@/lib/site/links';
import { findHome } from '@/lib/site/find-home';
import type { SiteViewModel } from '@/lib/site/view-model';

/**
 * Dónde se está renderizando el sitio.
 *  - public: sitio publicado (/catalogo/[negocio]).
 *  - preview: vista previa (builder o /preview). Muestra placeholders en
 *    secciones vacías y los enlaces los intercepta el contenedor.
 */
export type RenderEnv = {
  mode: 'public' | 'preview';
  basePath: string;
  currentPageId: string | null;
};

export function linkContext(site: SiteViewModel, env: RenderEnv): LinkContext {
  return {
    basePath: env.basePath,
    pages: site.pages.filter((p) => p.isPublished || env.mode === 'preview'),
    contact: site.business.contact,
    businessName: site.business.name,
  };
}

export function itemPath(env: RenderEnv, slug: string) {
  return `${env.basePath}/p/${slug}`;
}

export function homePageId(site: SiteViewModel) {
  return findHome(site.pages)?.id ?? null;
}
