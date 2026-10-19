import { msg, type TranslateParams } from '@/i18n/translate';
import type { BuilderState } from '../builder/reducer';

/**
 * Textos en español marcados con msg(): el panel muestra label/title
 * traducidos y envía el prompt en español (lo entiende también el modo
 * básico), mostrando al usuario su traducción.
 */
export type Suggestion = { label: string; prompt: string; params?: TranslateParams };
export type SuggestionSet = { title: string; items: Suggestion[] };

const s = (label: string, prompt = label, params?: TranslateParams): Suggestion => ({ label, prompt, ...(params ? { params } : {}) });

/** Sugerencias rápidas según lo que el usuario está editando. */
export function contextSuggestions(state: BuilderState): SuggestionSet {
  const page = state.pages.find((p) => p.id === state.selectedPageId) ?? state.pages[0];
  const section = page?.sections.find((x) => x.id === state.selectedSectionId);

  if (state.panel === 'design') {
    return {
      title: msg('¿Mejoramos el diseño?'),
      items: [s(msg('✨ Más moderno'), msg('Quiero que el sitio se vea más moderno')), s(msg('🎨 Color principal'), msg('Cambia el color principal a un tono que combine con mi marca')), s(msg('👔 Encabezado elegante'), msg('Haz que el encabezado sea más elegante')), s(msg('🔤 Tipografía'), msg('Usa una tipografía más elegante para los títulos'))],
    };
  }
  if (state.panel === 'navigation') {
    return {
      title: msg('¿Qué hacemos con el menú?'),
      items: [s(msg('➕ Agregar contacto al menú'), msg('Agrega la página de contacto al menú')), s(msg('💬 Botón de WhatsApp'), msg('Agrega un botón de WhatsApp al menú')), s(msg('↕️ Reordenar'), msg('Pon Inicio primero y Contacto al final del menú'))],
    };
  }
  if (section) {
    switch (section.type) {
      case 'products':
      case 'services':
      case 'catalog':
        return {
          title: msg('¿Quieres mejorar esta sección?'),
          items: [
            s(msg('🧩 Cambiar layout'), msg('Cambia el layout de esta sección a tarjetas grandes')),
            section.type === 'catalog' ? s(msg('🔎 Agregar filtros'), msg('Agrega filtros de precio y categorías a esta sección')) : s(msg('➕ Mostrar más productos'), msg('Muestra más productos en esta sección')),
            s(msg('🔢 4 por fila'), msg('Quiero que esta sección tenga 4 productos por fila')),
            s(msg('🖼️ Imágenes más grandes'), msg('Haz que los productos tengan una imagen más grande')),
          ],
        };
      case 'hero':
      case 'banner':
        return {
          title: msg('¿Quieres mejorar esta sección?'),
          items: [s(msg('✍️ Mejorar el título'), msg('Escribe un título y subtítulo más atractivos para esta sección')), s(msg('🎨 Cambiar el fondo'), msg('Pon un degradado de fondo en esta sección')), s(msg('💬 Botón de WhatsApp'), msg('Agrega un botón de WhatsApp en esta sección'))],
        };
      case 'text':
        return { title: msg('¿Quieres mejorar esta sección?'), items: [s(msg('✍️ Mejorar el texto'), msg('Mejora el texto de esta sección para que sea más claro y persuasivo')), s(msg('📏 Centrar'), msg('Centra el texto de esta sección')), s(msg('⬆️ Moverla arriba'), msg('Mueve esta sección un lugar arriba'))] };
      default:
        return { title: msg('¿Qué hacemos con esta sección?'), items: [s(msg('📄 Duplicarla'), msg('Duplica esta sección')), s(msg('⬆️ Moverla arriba'), msg('Mueve esta sección un lugar arriba')), s(msg('🎨 Cambiar el fondo'), msg('Cambia el fondo de esta sección a un color claro'))] };
    }
  }
  if (page && page.sections.length === 0) {
    return {
      title: msg('¿Quieres empezar con?'),
      items: [s(msg('✨ Armar esta página'), msg('Arma la página «{title}» completa con las secciones adecuadas'), { title: page.title }), s(msg('🦸 Un hero'), msg('Agrega un hero con título y botón de WhatsApp')), s(msg('🛍️ Productos destacados'), msg('Agrega una sección de productos destacados')), s(msg('📞 Contacto'), msg('Agrega una sección de contacto'))],
    };
  }
  return {
    title: msg('¿Qué quieres hacer?'),
    items: [
      s(msg('✨ Crear una página'), msg('Créame una página nueva para mi negocio')),
      s(msg('🛍️ Catálogo de productos'), msg('Créame una página de productos con categorías, destacados y catálogo completo')),
      s(msg('🎨 Mejorar diseño'), msg('Quiero que el sitio se vea más moderno')),
      s(msg('📄 Página de servicios'), msg('Quiero una página de servicios')),
      s(msg('📞 Agregar contacto'), msg('Agrega una sección de contacto al final')),
      s(msg('🖼️ Agregar galería'), msg('Agrega una sección de galería')),
    ],
  };
}
