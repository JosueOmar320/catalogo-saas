import { sanitizeCustomHtml } from '@/lib/site/custom-code';
import { Placeholder, SectionFrame } from '../SectionFrame';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/**
 * HTML propio del negocio, limpio (sin scripts ni eventos) y con los estilos
 * del sitio. Sólo se muestra si el administrador habilitó el código propio.
 */
export function HtmlSection({ section, site, env }: SectionProps<'html'>) {
  const t = siteTranslator(site.settings.language);
  const html = site.customCode ? sanitizeCustomHtml(section.content.html) : '';
  if (!html && env.mode === 'public') return null;
  return (
    <SectionFrame section={section} theme={site.theme}>
      <Placeholder show={!site.customCode}>{t('El código propio no está habilitado para este sitio: esta sección no se publica.')}</Placeholder>
      <Placeholder show={site.customCode && !html}>{t('Escribe tu HTML en el editor.')}</Placeholder>
      {html && <div className={styles.customHtml} dangerouslySetInnerHTML={{ __html: html }} />}
    </SectionFrame>
  );
}
