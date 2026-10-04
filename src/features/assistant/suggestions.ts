import type { BuilderState } from '../builder/reducer';

export type Suggestion = { label: string; prompt: string };
export type SuggestionSet = { title: string; items: Suggestion[] };

const s = (label: string, prompt = label): Suggestion => ({ label, prompt });

/** Sugerencias rápidas según lo que el usuario está editando. */
export function contextSuggestions(state: BuilderState): SuggestionSet {
  const page = state.pages.find((p) => p.id === state.selectedPageId) ?? state.pages[0];
  const section = page?.sections.find((x) => x.id === state.selectedSectionId);

  if (state.panel === 'design') {
    return {
      title: '¿Mejoramos el diseño?',
      items: [s('✨ Más moderno', 'Quiero que el sitio se vea más moderno'), s('🎨 Color principal', 'Cambia el color principal a un tono que combine con mi marca'), s('👔 Encabezado elegante', 'Haz que el encabezado sea más elegante'), s('🔤 Tipografía', 'Usa una tipografía más elegante para los títulos')],
    };
  }
  if (state.panel === 'navigation') {
    return {
      title: '¿Qué hacemos con el menú?',
      items: [s('➕ Agregar contacto al menú', 'Agrega la página de contacto al menú'), s('💬 Botón de WhatsApp', 'Agrega un botón de WhatsApp al menú'), s('↕️ Reordenar', 'Pon Inicio primero y Contacto al final del menú')],
    };
  }
  if (section) {
    switch (section.type) {
      case 'products':
      case 'services':
      case 'catalog':
        return {
          title: '¿Quieres mejorar esta sección?',
          items: [
            s('🧩 Cambiar layout', 'Cambia el layout de esta sección a tarjetas grandes'),
            section.type === 'catalog' ? s('🔎 Agregar filtros', 'Agrega filtros de precio y categorías a esta sección') : s('➕ Mostrar más productos', 'Muestra más productos en esta sección'),
            s('🔢 4 por fila', 'Quiero que esta sección tenga 4 productos por fila'),
            s('🖼️ Imágenes más grandes', 'Haz que los productos tengan una imagen más grande'),
          ],
        };
      case 'hero':
      case 'banner':
        return {
          title: '¿Quieres mejorar esta sección?',
          items: [s('✍️ Mejorar el título', 'Escribe un título y subtítulo más atractivos para esta sección'), s('🎨 Cambiar el fondo', 'Pon un degradado de fondo en esta sección'), s('💬 Botón de WhatsApp', 'Agrega un botón de WhatsApp en esta sección')],
        };
      case 'text':
        return { title: '¿Quieres mejorar esta sección?', items: [s('✍️ Mejorar el texto', 'Mejora el texto de esta sección para que sea más claro y persuasivo'), s('📏 Centrar', 'Centra el texto de esta sección'), s('⬆️ Moverla arriba', 'Mueve esta sección un lugar arriba')] };
      default:
        return { title: '¿Qué hacemos con esta sección?', items: [s('📄 Duplicarla', 'Duplica esta sección'), s('⬆️ Moverla arriba', 'Mueve esta sección un lugar arriba'), s('🎨 Cambiar el fondo', 'Cambia el fondo de esta sección a un color claro')] };
    }
  }
  if (page && page.sections.length === 0) {
    return {
      title: '¿Quieres empezar con?',
      items: [s('✨ Armar esta página', `Arma la página «${page.title}» completa con las secciones adecuadas`), s('🦸 Un hero', 'Agrega un hero con título y botón de WhatsApp'), s('🛍️ Productos destacados', 'Agrega una sección de productos destacados'), s('📞 Contacto', 'Agrega una sección de contacto')],
    };
  }
  return {
    title: '¿Qué quieres hacer?',
    items: [
      s('✨ Crear una página', 'Créame una página nueva para mi negocio'),
      s('🛍️ Catálogo de productos', 'Créame una página de productos con categorías, destacados y catálogo completo'),
      s('🎨 Mejorar diseño', 'Quiero que el sitio se vea más moderno'),
      s('📄 Página de servicios', 'Quiero una página de servicios'),
      s('📞 Agregar contacto', 'Agrega una sección de contacto al final'),
      s('🖼️ Agregar galería', 'Agrega una sección de galería'),
    ],
  };
}
