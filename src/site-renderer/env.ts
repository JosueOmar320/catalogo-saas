import type { LinkContext, LinkTexts } from '@/lib/site/links';
import { siteTranslator } from './site-i18n';
import type { SiteViewModel } from '@/lib/site/view-model';

/**
 * Dónde se está renderizando el sitio.
 *  - public: sitio publicado (/catalogo/[negocio]).
 *  - preview: vista previa (builder o /preview). Muestra placeholders en
 *    secciones vacías y los enlaces los intercepta el contenedor.
 */
export type RenderEnv = {
  mode: 'public' | 'preview';
  basePath: string;
  currentPageId: string | null;
};

export function linkContext(site: SiteViewModel, env: RenderEnv): LinkContext {
  return {
    basePath: env.basePath,
    pages: site.pages.filter((p) => p.isPublished || env.mode === 'preview'),
    contact: site.business.contact,
    businessName: site.business.name,
    texts: linkTexts(site),
  };
}

/** Textos por defecto de enlaces y menú en el idioma del negocio. */
function linkTexts(site: SiteViewModel): LinkTexts {
  const t = siteTranslator(site.settings.language);
  return { whatsappMessage: t('Hola {name}, quisiera más información.', { name: site.business.name }), url: t('Enlace'), phone: t('Llamar'), email: t('Email') };
}

export function itemPath(env: RenderEnv, slug: string) {
  return `${env.basePath}/p/${slug}`;
}
