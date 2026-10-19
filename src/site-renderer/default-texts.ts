import type { Translator } from '@/i18n/translate';

/**
 * Textos de fábrica que el negocio puede cambiar (badges del tema, botones y
 * mensajes de contacto, botón del header, títulos de bloques del PDF). Si
 * siguen con el texto por defecto en español se muestran en el idioma del
 * sitio; si el negocio los personalizó son su contenido y se respetan tal cual.
 * Sin parámetros: las variables {producto}, {url}… se completan después.
 */
export function defaultText(text: string, t: Translator): string {
  switch (text) {
    // Badges (tema)
    case 'Nuevo':
      return t('Nuevo');
    case 'Destacado':
      return t('Destacado');
    case 'Oferta':
      return t('Oferta');
    case 'Popular':
      return t('Popular');
    case 'Agotado':
      return t('Agotado');
    // Acciones de contacto (configuración del catálogo)
    case 'Consultar por WhatsApp':
      return t('Consultar por WhatsApp');
    case 'Llamar':
      return t('Llamar');
    case 'Enviar email':
      return t('Enviar email');
    case 'Hola, me interesa "{producto}" ({precio}) que vi en su catálogo: {url}':
      return t('Hola, me interesa "{producto}" ({precio}) que vi en su catálogo: {url}');
    case 'Consulta sobre {producto}':
      return t('Consulta sobre {producto}');
    // Botón del header
    case 'Contáctanos':
      return t('Contáctanos');
    // Bloques del PDF
    case 'Contenido':
      return t('Contenido');
    case 'Contacto':
      return t('Contacto');
    case 'Gracias':
      return t('Gracias');
    default:
      return text;
  }
}
