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

/** Memo: al editar una sección en el builder sólo se re-renderiza esa sección. */
export const RenderSection = memo(function RenderSection({ section, site, env, index }: RenderSectionProps) {
  const Component = SECTION_COMPONENTS[section.type] as React.ComponentType<RenderSectionProps & { links: ReturnType<typeof linkContext> }>;
  return <Component section={section} site={site} env={env} index={index} links={linkContext(site, env)} />;
});

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
