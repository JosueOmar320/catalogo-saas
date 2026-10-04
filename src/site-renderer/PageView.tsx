import { memo } from 'react';
import { headerOverlaysPage } from '@/lib/site/resolve';
import type { Section } from '@/lib/site/section-schemas';
import type { SitePage } from '@/lib/site/pages';
import type { SiteViewModel } from '@/lib/site/view-model';
import { BackgroundLayers } from './Background';
import { linkContext, type RenderEnv } from './env';
import { SECTION_COMPONENTS } from './sections';
import styles from './site.module.css';

type RenderSectionProps = { section: Section; site: SiteViewModel; env: RenderEnv; index: number };

/** Las secciones sólo usan las páginas para resolver enlaces (id, slug, inicio, publicada). */
function samePageLinks(a: SitePage[], b: SitePage[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.id === b[i].id && p.slug === b[i].slug && p.isHome === b[i].isHome && p.isPublished === b[i].isPublished);
}

/**
 * ¿Cambió algo del sitio que una sección dibuje? Todo se compara por
 * referencia (el borrador conserva las referencias de lo que no cambia),
 * salvo `pages` (editar cualquier sección crea un arreglo nuevo de páginas,
 * pero sus enlaces siguen iguales) y `navigation` (no la usa ninguna sección).
 */
function sameSiteForSections(a: SiteViewModel, b: SiteViewModel): boolean {
  if (a === b) return true;
  for (const key of Object.keys(a) as (keyof SiteViewModel)[]) {
    if (key === 'pages' || key === 'navigation') continue;
    if (a[key] !== b[key]) return false;
  }
  return samePageLinks(a.pages, b.pages);
}

const sameEnv = (a: RenderEnv, b: RenderEnv) => a === b || (a.mode === b.mode && a.basePath === b.basePath && a.currentPageId === b.currentPageId);

/** Memo: al editar una sección en el builder sólo se re-renderiza esa sección. */
export const RenderSection = memo(function RenderSection({ section, site, env, index }: RenderSectionProps) {
  const Component = SECTION_COMPONENTS[section.type] as React.ComponentType<RenderSectionProps & { links: ReturnType<typeof linkContext> }>;
  return <Component section={section} site={site} env={env} index={index} links={linkContext(site, env)} />;
}, (prev, next) => prev.section === next.section && prev.index === next.index && sameEnv(prev.env, next.env) && sameSiteForSections(prev.site, next.site));

/** Una página: su fondo propio (sobrescribe el global) + sus secciones visibles. */
export function PageView({ page, site, env }: { page: SitePage; site: SiteViewModel; env: RenderEnv }) {
  const visible = page.sections.filter((s) => s.visible);
  const overlay = headerOverlaysPage(site.theme, page.sections);
  return (
    <div className={`${styles.page} ${overlay ? styles.pageOverlay : ''}`} data-page-id={page.id}>
      <BackgroundLayers background={page.style.background} />
      {visible.map((section, index) => (
        <RenderSection key={section.id} section={section} site={site} env={env} index={index} />
      ))}
    </div>
  );
}
