import type { Locale } from '@/i18n/config';
import { siteTranslator } from './site-i18n';

/**
 * Textos de "no encontrado" del sitio público (página y metadatos), en el
 * idioma del negocio si se conoce. Viven aquí (y no en app/catalogo) para
 * usar el catálogo del sitio y no leer cookies: las páginas siguen estáticas.
 */
export function siteStatusTexts(language?: Locale) {
  const t = siteTranslator(language);
  return {
    unavailable: t('No disponible'),
    notFound: t('No encontrado'),
    missingTitle: t('Esta página no existe o no está publicada'),
    missingText: t('Si eres el dueño, publícala desde tu panel para que tus clientes puedan verla.'),
    goTo: (app: string) => t('Ir a {app}', { app }),
  };
}
