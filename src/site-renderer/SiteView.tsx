import { findHome, type SitePage } from '@/lib/site/pages';
import { pagePath } from '@/lib/site/links';
import type { SiteViewModel } from '@/lib/site/view-model';
import { buildHeaderProps } from './chrome';
import type { RenderEnv } from './env';
import { PageView } from './PageView';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { SiteShell } from './SiteShell';
import styles from './site.module.css';

/**
 * Sitio completo (header + página + footer). Lo usan la preview del builder,
 * /preview y la demo. El sitio público arma lo mismo con un layout de Next
 * para que el header/footer no se vuelvan a renderizar al navegar.
 */
export function SiteView({ site, page, env, children }: { site: SiteViewModel; page?: SitePage; env: RenderEnv; children?: React.ReactNode }) {
  const current = page ?? findHome(site.pages);
  // Con contenido propio (ficha de producto) ningún ítem del menú queda activo.
  const header = buildHeaderProps(site, env, children ? `${env.basePath}/p` : current ? pagePath(env.basePath, current) : env.basePath);
  return (
    <SiteShell theme={site.theme}>
      <SiteHeader {...header} />
      <main className={styles.main}>{children ?? (current && <PageView page={current} site={site} env={{ ...env, currentPageId: current.id }} />)}</main>
      <SiteFooter site={site} navItems={header.items} />
    </SiteShell>
  );
}
