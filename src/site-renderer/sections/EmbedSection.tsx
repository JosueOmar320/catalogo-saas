import { Placeholder, SectionFrame } from '../SectionFrame';
import { EmbedFrame } from '../EmbedFrame';
import { siteTranslator } from '../site-i18n';
import type { SectionProps } from './types';

/**
 * Widget con código (reservas, formularios, mapas…) en un iframe aislado.
 * Sólo se muestra si el administrador habilitó el código propio.
 */
export function EmbedSection({ section, site, env }: SectionProps<'embed'>) {
  const t = siteTranslator(site.settings.language);
  const { code, title, height } = section.content;
  const show = site.customCode && code.trim() !== '';
  if (!show && env.mode === 'public') return null;
  return (
    <SectionFrame section={section} theme={site.theme}>
      <Placeholder show={!site.customCode}>{t('El código propio no está habilitado para este sitio: esta sección no se publica.')}</Placeholder>
      <Placeholder show={site.customCode && !show}>{t('Pega el código del widget en el editor.')}</Placeholder>
      {show && <EmbedFrame code={code} title={title || t('Contenido externo')} height={height} />}
    </SectionFrame>
  );
}
