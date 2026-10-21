import { msg } from '@/i18n/translate';

/**
 * Tipo de sitio (lo decide el administrador):
 *  · catalog: negocio con productos, servicios, pedidos, reseñas y PDF.
 *  · website: sitio web sin catálogo (portafolio, organización, landing…):
 *    el panel y el editor ocultan todo lo de productos.
 */
export const SITE_KINDS = ['catalog', 'website'] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const SITE_KIND_LABELS: Record<SiteKind, { label: string; description: string }> = {
  catalog: { label: msg('Negocio con catálogo'), description: msg('Productos y servicios, pedidos por WhatsApp, reseñas y catálogo PDF.') },
  website: { label: msg('Sitio web'), description: msg('Páginas informativas sin productos ni pedidos: portafolio, organización, evento, landing…') },
};

export const parseSiteKind = (value: unknown): SiteKind => (value === 'website' ? 'website' : 'catalog');
export const isCatalogSite = (kind: SiteKind) => kind === 'catalog';

/** Secciones del panel que sólo existen en un negocio con catálogo (también se bloquean por URL). */
export const CATALOG_ONLY_PATHS = ['/dashboard/catalog', '/dashboard/pedidos', '/dashboard/resenas', '/dashboard/export/pdf'];
export const isCatalogOnlyPath = (pathname: string) => CATALOG_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
