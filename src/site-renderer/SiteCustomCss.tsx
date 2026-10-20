import { scopeCustomCss } from '@/lib/site/custom-code';
import type { SiteViewModel } from '@/lib/site/view-model';

/**
 * CSS propio del negocio, limitado a su sitio ([data-site]). Sólo si el
 * administrador habilitó el código propio.
 */
export function SiteCustomCss({ site }: { site: Pick<SiteViewModel, 'customCode' | 'theme'> }) {
  const css = site.customCode ? scopeCustomCss(site.theme.customCss) : '';
  return css ? <style data-custom-css dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
