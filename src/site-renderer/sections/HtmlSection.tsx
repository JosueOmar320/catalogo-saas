import { customHtmlFxCss, customHtmlId, renderCustomHtml } from '@/lib/site/custom-code';
import { CustomHtml } from '../CustomHtml';
import { Placeholder, SectionFrame } from '../SectionFrame';
import { siteTranslator } from '../site-i18n';
import type { SectionProps } from './types';

/**
 * HTML propio del negocio, limpio (sin scripts ni eventos) y con los estilos
 * del sitio. Sólo se muestra si el administrador habilitó el código propio.
 */
export function HtmlSection({ section, site, env }: SectionProps<'html'>) {
  const t = siteTranslator(site.settings.language);
  // HTML limpio + su <style> limitado a esta sección + los efectos fx.
  const { markup: html, css } = site.customCode ? renderCustomHtml(section.content.html, section.id) : { markup: '', css: '' };
  if (!html && env.mode === 'public') return null;
  return (
    <SectionFrame section={section} theme={site.theme}>
      <Placeholder show={!site.customCode}>{t('El código propio no está habilitado para este sitio: esta sección no se publica.')}</Placeholder>
      <Placeholder show={site.customCode && !html}>{t('Escribe tu HTML en el editor.')}</Placeholder>
      {html && <CustomHtml id={customHtmlId(section.id)} html={html} css={`${customHtmlFxCss()}\n${css}`} />}
    </SectionFrame>
  );
}
