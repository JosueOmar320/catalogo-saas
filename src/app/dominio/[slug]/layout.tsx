import type { Metadata } from 'next';
import { PublicSiteLayoutContent, publicSiteMetadata } from '@/app/catalogo/[slug]/public-layout';

/**
 * El sitio de un negocio en su dominio propio. El proxy reescribe
 * mitienda.com/<ruta> → /dominio/<negocio>/<ruta> (la dirección del navegador
 * no cambia) y los enlaces van en la raíz (basePath ""). Mismo caché que
 * /catalogo/<negocio>: se invalida al guardar.
 */
export const revalidate = 3600;

export async function generateMetadata({ params }: LayoutProps<'/dominio/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return publicSiteMetadata(slug);
}

export default async function DomainSiteLayout({ children, params }: LayoutProps<'/dominio/[slug]'>) {
  const { slug } = await params;
  return (
    <PublicSiteLayoutContent slug={slug} basePath="">
      {children}
    </PublicSiteLayoutContent>
  );
}
