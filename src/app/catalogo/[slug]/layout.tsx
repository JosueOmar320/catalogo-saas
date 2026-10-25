import type { Metadata } from 'next';
import { PublicSiteLayoutContent, publicSiteMetadata } from './public-layout';

// ISR: se sirve desde caché y se invalida por tag cuando el dueño guarda cambios.
export const revalidate = 3600;

export async function generateMetadata({ params }: LayoutProps<'/catalogo/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return publicSiteMetadata(slug);
}

export default async function PublicSiteLayout({ children, params }: LayoutProps<'/catalogo/[slug]'>) {
  const { slug } = await params;
  return (
    <PublicSiteLayoutContent slug={slug} basePath={`/catalogo/${slug}`}>
      {children}
    </PublicSiteLayoutContent>
  );
}
