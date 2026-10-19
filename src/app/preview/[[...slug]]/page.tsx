import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemDetail, SiteView } from '@/site-renderer';
import { getSiteForAdmin } from '@/features/catalog/queries';
import { getT } from '@/i18n/server';
import { requireBusinessContext } from '@/lib/auth/session';
import styles from '../preview.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Vista previa'), robots: { index: false, follow: false } };
}

/**
 * Vista previa privada del sitio guardado (incluye páginas ocultas y el
 * catálogo sin publicar). Navegable: /preview, /preview/<pagina>, /preview/p/<item>.
 */
export default async function PreviewPage({ params }: PageProps<'/preview/[[...slug]]'>) {
  const ctx = await requireBusinessContext();
  const t = await getT();
  const { slug } = await params;
  const site = await getSiteForAdmin(ctx);
  const published = ctx.catalog.status === 'published';
  const env = { mode: 'public' as const, basePath: '/preview', currentPageId: null };
  // En la vista previa también se navega a páginas ocultas.
  const previewSite = { ...site, pages: site.pages.map((p) => ({ ...p, isPublished: true })) };

  let content: React.ReactNode;
  if (slug?.[0] === 'p') {
    const item = site.items.find((i) => i.slug === slug[1]);
    if (!item) notFound();
    content = (
      <SiteView site={previewSite} env={env}>
        <ItemDetail site={previewSite} item={item} backHref="/preview" env={env} />
      </SiteView>
    );
  } else {
    const page = slug?.[0] ? previewSite.pages.find((p) => p.slug === slug[0]) : previewSite.pages.find((p) => p.isHome);
    if (!page) notFound();
    content = <SiteView site={previewSite} page={page} env={{ ...env, currentPageId: page.id }} />;
  }

  return (
    <>
      <div className={styles.banner}>
        <span>
          <strong>{t('Vista previa')}</strong> · {published ? t('Tu sitio está publicado.') : t('Sólo tú puedes ver esta página.')}
        </span>
        <Link href="/dashboard/sitio">{t('Volver al editor')}</Link>
      </div>
      {content}
    </>
  );
}
