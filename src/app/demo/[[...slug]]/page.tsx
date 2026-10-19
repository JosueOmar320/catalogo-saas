import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ItemDetail, SiteView } from '@/site-renderer';
import { applyPreset, getPreset, THEME_PRESETS } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { env } from '@/lib/env';
import { buildSamplePages, buildSampleSite } from '@/lib/site/sample-site';

export const metadata: Metadata = {
  title: 'Demo',
  description: `Así se ve un sitio creado con ${env.appName}.`,
};

/** Sitio de ejemplo navegable. ?preset=luxury permite probar los temas. */
export default async function DemoPage({ params, searchParams }: PageProps<'/demo/[[...slug]]'>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const presetId = typeof query.preset === 'string' && THEME_PRESETS.some((p) => p.id === query.preset) ? query.preset : 'restaurant';
  const theme = applyPreset(DEFAULT_THEME, getPreset(presetId));
  const pages = buildSamplePages();
  const menu = pages.find((p) => p.slug === 'menu');
  // La demo muestra la barra de anuncios (los negocios nuevos la tienen apagada).
  const announcement = { ...theme.announcement, enabled: true, text: 'Envío gratis en pedidos desde $300', linkLabel: 'Ver el menú', link: { ...theme.announcement.link, kind: 'page' as const, pageId: menu?.id ?? '' } };
  const site = buildSampleSite({ theme: { ...theme, announcement }, pages });
  const demoEnv = { mode: 'public' as const, basePath: '/demo', currentPageId: null };
  if (slug?.[0] === 'p') {
    const item = site.items.find((i) => i.slug === slug[1]);
    if (!item) notFound();
    return (
      <SiteView site={site} env={demoEnv}>
        <ItemDetail site={site} item={item} backHref="/demo" env={{ mode: 'public', basePath: '/demo', currentPageId: null }} />
      </SiteView>
    );
  }
  const pageSlug = slug?.[0];
  const page = pageSlug ? site.pages.find((p) => p.slug === pageSlug) : site.pages.find((p) => p.isHome);
  if (!page) notFound();

  return <SiteView site={site} page={page} env={{ mode: 'public', basePath: '/demo', currentPageId: page.id }} />;
}
