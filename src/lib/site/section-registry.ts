import type { IconId } from '@/lib/design/icons';
import type { SectionType } from './section-schemas';

/** Metadatos de cada tipo de sección para el builder (catálogo de secciones). */
export const SECTION_META: Record<SectionType, { label: string; description: string; icon: IconId; group: 'Principal' | 'Catálogo' | 'Contenido' | 'Contacto' | 'Diseño' }> = {
  hero: { label: 'Hero', description: 'Portada grande con título, imagen y botones.', icon: 'sparkles', group: 'Principal' },
  banner: { label: 'Banner', description: 'Franja promocional con texto y botón.', icon: 'percent', group: 'Principal' },
  products: { label: 'Productos', description: 'Selección de productos: destacados, recientes, de una categoría o elegidos.', icon: 'shopping-bag', group: 'Catálogo' },
  services: { label: 'Servicios', description: 'Servicios con descripción, precio y botón de contacto.', icon: 'handshake', group: 'Catálogo' },
  catalog: { label: 'Catálogo completo', description: 'Todos los ítems con buscador, filtros y categorías.', icon: 'clipboard-list', group: 'Catálogo' },
  categories: { label: 'Categorías', description: 'Accesos a tus categorías como tarjetas, lista o imagen + texto.', icon: 'tag', group: 'Catálogo' },
  text: { label: 'Texto', description: 'Título, texto con formato e imagen opcional.', icon: 'book-open', group: 'Contenido' },
  gallery: { label: 'Galería', description: 'Imágenes en cuadrícula, mosaico o carrusel.', icon: 'camera', group: 'Contenido' },
  features: { label: 'Beneficios', description: 'Íconos con título y texto (envíos, garantía, horarios…).', icon: 'circle-check', group: 'Contenido' },
  testimonials: { label: 'Testimonios', description: 'Opiniones de clientes con foto y calificación.', icon: 'quote', group: 'Contenido' },
  contact: { label: 'Contacto', description: 'Teléfono, WhatsApp, email, dirección, horarios y mapa.', icon: 'phone', group: 'Contacto' },
  social: { label: 'Redes sociales', description: 'Tus perfiles como íconos, botones o tarjetas.', icon: 'globe', group: 'Contacto' },
  spacer: { label: 'Separador', description: 'Espacio vertical con línea u ornamento opcional.', icon: 'arrow-right', group: 'Diseño' },
  image: { label: 'Imagen', description: 'Una imagen grande con leyenda y enlace opcional.', icon: 'image', group: 'Contenido' },
  video: { label: 'Video', description: 'YouTube, Vimeo o un video propio, solo o con texto.', icon: 'play', group: 'Contenido' },
  faq: { label: 'Preguntas frecuentes', description: 'Preguntas y respuestas desplegables.', icon: 'circle-help', group: 'Contenido' },
  pricing: { label: 'Precios y planes', description: 'Paquetes o planes con precio, beneficios y botón.', icon: 'credit-card', group: 'Catálogo' },
  team: { label: 'Equipo', description: 'Personas con foto, cargo y descripción.', icon: 'users', group: 'Contenido' },
  stats: { label: 'Estadísticas', description: 'Cifras destacadas: clientes, años, proyectos…', icon: 'chart', group: 'Contenido' },
  logos: { label: 'Logos', description: 'Marcas, clientes o certificaciones.', icon: 'badge-check', group: 'Contenido' },
};

export const SECTION_GROUPS = ['Principal', 'Catálogo', 'Contenido', 'Contacto', 'Diseño'] as const;
