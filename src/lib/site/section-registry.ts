import type { IconId } from '@/lib/design/icons';
import { msg } from '@/i18n/translate';
import type { SectionType } from './section-schemas';

/** Metadatos de cada tipo de sección para el builder (catálogo de secciones). */
export const SECTION_META: Record<SectionType, { label: string; description: string; icon: IconId; group: 'Principal' | 'Catálogo' | 'Contenido' | 'Contacto' | 'Diseño' }> = {
  hero: { label: msg('Hero'), description: msg('Portada grande con título, imagen y botones.'), icon: 'sparkles', group: 'Principal' },
  banner: { label: msg('Banner'), description: msg('Franja promocional con texto y botón.'), icon: 'percent', group: 'Principal' },
  products: { label: msg('Productos'), description: msg('Selección de productos: destacados, recientes, de una categoría o elegidos.'), icon: 'shopping-bag', group: 'Catálogo' },
  services: { label: msg('Servicios'), description: msg('Servicios con descripción, precio y botón de contacto.'), icon: 'handshake', group: 'Catálogo' },
  catalog: { label: msg('Catálogo completo'), description: msg('Todos los ítems con buscador, filtros y categorías.'), icon: 'clipboard-list', group: 'Catálogo' },
  categories: { label: msg('Categorías'), description: msg('Accesos a tus categorías como tarjetas, lista o imagen + texto.'), icon: 'tag', group: 'Catálogo' },
  text: { label: msg('Texto'), description: msg('Título, texto con formato e imagen opcional.'), icon: 'book-open', group: 'Contenido' },
  gallery: { label: msg('Galería'), description: msg('Imágenes en cuadrícula, mosaico o carrusel.'), icon: 'camera', group: 'Contenido' },
  features: { label: msg('Beneficios'), description: msg('Íconos con título y texto (envíos, garantía, horarios…).'), icon: 'circle-check', group: 'Contenido' },
  testimonials: { label: msg('Testimonios'), description: msg('Opiniones de clientes con foto y calificación.'), icon: 'quote', group: 'Contenido' },
  contact: { label: msg('Contacto'), description: msg('Teléfono, WhatsApp, email, dirección, horarios y mapa.'), icon: 'phone', group: 'Contacto' },
  social: { label: msg('Redes sociales'), description: msg('Tus perfiles como íconos, botones o tarjetas.'), icon: 'globe', group: 'Contacto' },
  spacer: { label: msg('Separador'), description: msg('Espacio vertical con línea u ornamento opcional.'), icon: 'arrow-right', group: 'Diseño' },
  image: { label: msg('Imagen'), description: msg('Una imagen grande con leyenda y enlace opcional.'), icon: 'image', group: 'Contenido' },
  video: { label: msg('Video'), description: msg('YouTube, Vimeo o un video propio, solo o con texto.'), icon: 'play', group: 'Contenido' },
  faq: { label: msg('Preguntas frecuentes'), description: msg('Preguntas y respuestas desplegables.'), icon: 'circle-help', group: 'Contenido' },
  pricing: { label: msg('Precios y planes'), description: msg('Paquetes o planes con precio, beneficios y botón.'), icon: 'credit-card', group: 'Catálogo' },
  team: { label: msg('Equipo'), description: msg('Personas con foto, cargo y descripción.'), icon: 'users', group: 'Contenido' },
  stats: { label: msg('Estadísticas'), description: msg('Cifras destacadas: clientes, años, proyectos…'), icon: 'chart', group: 'Contenido' },
  logos: { label: msg('Logos'), description: msg('Marcas, clientes o certificaciones.'), icon: 'badge-check', group: 'Contenido' },
  columns: { label: msg('Columnas (libre)'), description: msg('Arma tu composición: imagen + texto, tarjetas, listas con íconos, varios botones, cifras…'), icon: 'columns', group: 'Principal' },
};

export const SECTION_GROUPS = [msg('Principal'), msg('Catálogo'), msg('Contenido'), msg('Contacto'), msg('Diseño')] as const;
