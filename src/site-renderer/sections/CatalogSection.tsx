import { toCatalogClientSite } from '../catalog-client-model';
import { CatalogGrid } from './CatalogGrid';
import type { SectionProps } from './types';

/**
 * Sección de catálogo. Envoltorio sin 'use client': recorta el modelo del
 * sitio a lo que la cuadrícula necesita antes de cruzar al Client Component
 * (en el sitio público corre en el servidor y el payload RSC no lleva las
 * descripciones largas, las páginas, el SEO ni las reseñas; en la vista
 * previa del editor corre en el navegador, como función pura).
 */
export function CatalogSection({ section, site, env }: SectionProps<'catalog'>) {
  return <CatalogGrid section={section} site={toCatalogClientSite(site, section)} env={env} />;
}
