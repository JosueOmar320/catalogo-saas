import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ItemDetail, SiteView } from '@/site-renderer';
import { applyPreset, getPreset, THEME_PRESETS } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { env } from '@/lib/env';
import { buildSampleSite } from '@/lib/site/sample-site';

export const metadata: Metadata = {
  title: 'Demo',
  description: `Así se ve un sitio creado con ${env.appName}.`,
};

/** Sitio de ejemplo navegable. ?preset=luxury permite probar los temas. */
export default async function DemoPage({ params, searchParams }: PageProps<'/demo/[[...slug]]'>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const presetId = typeof query.preset === 'string' && THEME_PRESETS.some((p) => p.id === query.preset) ? query.preset : 'restaurant';
  const site = buildSampleSite({ theme: applyPreset(DEFAULT_THEME, getPreset(presetId)) });
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
