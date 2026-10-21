import { requireCatalogSite } from '@/lib/auth/session';

/** Productos, servicios, categorías, atributos y orden: sólo en un negocio con catálogo. */
export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  await requireCatalogSite();
  return children;
}
