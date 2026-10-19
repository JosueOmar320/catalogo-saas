import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import SITE_EN from '@/i18n/en/site';
import { createTranslator, type Translator } from '@/i18n/translate';
import type { YesNo } from '@/lib/catalog/attributes-core';

/**
 * Textos fijos del sitio público y del PDF ("Buscar", "Agotado"…) en el
 * idioma que eligió el NEGOCIO (catalogs.settings.language), no el visitante:
 * así el sitio sigue siendo estático y cacheable. Catálogo propio y chico
 * (src/i18n/en/site.ts): no se carga el de la app en el JavaScript público.
 */
export function siteTranslator(language: Locale | undefined): Translator {
  return createTranslator(language ?? DEFAULT_LOCALE, SITE_EN);
}

/** "Sí"/"No" de los atributos booleanos en el idioma del negocio. */
export function siteYesNo(language: Locale | undefined): YesNo {
  const t = siteTranslator(language);
  return { yes: t('Sí'), no: t('No') };
}
