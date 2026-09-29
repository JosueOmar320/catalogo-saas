import type { SitePage } from './pages';
import { createSection, type Section } from './section-schemas';

/**
 * Estructuras de página listas para usar. Las usan el menú "Nueva página"
 * del builder y Garfield AI ("créame una página de servicios…"). Sólo usan
 * secciones existentes; todo es contenido editable.
 */
export const PAGE_BLUEPRINT_IDS = ['blank', 'home', 'products', 'services', 'about', 'contact', 'promotions', 'gallery', 'menu'] as const;
export type PageBlueprintId = (typeof PAGE_BLUEPRINT_IDS)[number];

export type BlueprintOptions = {
  /** Rubro o tema ("empresa de limpieza", "tienda de ropa"): ajusta los textos. */
  topic?: string;
  /** Página a la que enlazan los botones "Ver productos/servicios" (si existe). */
  catalogPageId?: string;
};

type Blueprint = {
  template: SitePage['template'];
  title: string;
  slug: string;
  description: string;
  sections: (options: BlueprintOptions) => Section[];
};

const id = () => crypto.randomUUID();
const whatsapp = (label = 'Escribir por WhatsApp') => ({ label, icon: 'message-circle', link: { kind: 'whatsapp' } });
const about = (topic?: string) => (topic ? ` de ${topic}` : '');
const cta = (title: string, subtitle: string) =>
  createSection('banner', { title, subtitle, layout: 'boxed', button: whatsapp() }, { background: { type: 'gradient' }, textColor: 'light' });

export const PAGE_BLUEPRINT_DEFS: Record<PageBlueprintId, Blueprint> = {
  blank: {
    template: 'custom',
    title: 'Página en blanco',
    slug: 'nueva-pagina',
    description: 'Empieza desde cero.',
    sections: () => [createSection('text', { title: 'Título de la página' })],
  },
  home: {
    template: 'home',
    title: 'Inicio',
    slug: 'inicio',
    description: 'Portada, beneficios, destacados, categorías, opiniones y contacto.',
    sections: ({ topic, catalogPageId }) => [
      createSection('hero', {
        height: 'lg',
        subtitle: topic ? `Lo mejor${about(topic)}, cerca de ti.` : '',
        primaryButton: catalogPageId ? { label: 'Ver catálogo', link: { kind: 'page', pageId: catalogPageId } } : whatsapp('Escríbenos'),
        secondaryButton: { ...whatsapp('WhatsApp'), variant: 'secondary' },
      }),
      createSection('features', {
        items: [
          { id: id(), icon: 'message-circle', title: 'Atención directa', text: 'Resolvemos tus dudas por WhatsApp.' },
          { id: id(), icon: 'shield-check', title: 'Calidad garantizada', text: 'Cuidamos cada detalle.' },
          { id: id(), icon: 'truck', title: 'Entregas', text: 'Consulta envíos y tiempos de entrega.' },
        ],
      }),
      createSection('products', { eyebrow: 'Favoritos', title: 'Lo más pedido', collection: { source: 'featured', itemType: 'any', limit: 8 } }),
      createSection('categories', { title: 'Explora', display: 'imageText', linkPageId: catalogPageId ?? '' }),
      createSection('testimonials', {
        title: 'Lo que dicen nuestros clientes',
        items: [
          { id: id(), name: 'Cliente satisfecho', text: 'Excelente atención y calidad. ¡Muy recomendable!', rating: 5 },
          { id: id(), name: 'Cliente frecuente', text: 'Siempre cumplen con lo prometido.', rating: 5 },
        ],
      }),
      createSection('contact', { title: 'Visítanos', layout: 'split' }),
    ],
  },
  products: {
    template: 'products',
    title: 'Productos',
    slug: 'productos',
    description: 'Categorías, destacados, catálogo con filtros y promoción.',
    sections: ({ topic }) => [
      createSection('hero', { title: topic ? `Nuestra ${topic}` : 'Nuestros productos', subtitle: 'Encuentra lo que buscas y consúltanos por WhatsApp.', height: 'sm', layout: 'left' }),
      createSection('categories', { title: 'Categorías', display: 'cards' }),
      createSection('products', { title: 'Destacados', collection: { source: 'featured', itemType: 'product', limit: 8 }, presentation: { layout: 'grid', columns: { desktop: 4, tablet: 3, mobile: 2 } } }),
      createSection('catalog', { title: 'Todos los productos', itemType: 'product', filters: { price: true }, pagination: { mode: 'loadMore', perPage: 24 } }),
      cta('¿Buscas algo especial?', 'Escríbenos y te ayudamos a encontrarlo.'),
      createSection('contact', { title: 'Contacto', layout: 'centered' }),
    ],
  },
  services: {
    template: 'services',
    title: 'Servicios',
    slug: 'servicios',
    description: 'Introducción, servicios, beneficios, llamado a la acción y contacto.',
    sections: ({ topic }) => [
      createSection('hero', { title: topic ? `Servicios${about(topic)}` : 'Nuestros servicios', subtitle: 'Soluciones a tu medida, con atención personalizada.', height: 'md', primaryButton: whatsapp('Cotizar ahora') }),
      createSection('text', {
        title: '¿Cómo trabajamos?',
        body: 'Escuchamos lo que necesitas, te proponemos la mejor opción y cumplimos en tiempo y forma.\n\n- Diagnóstico sin costo\n- Presupuesto claro\n- Garantía de satisfacción',
        alignment: 'center',
        width: 'narrow',
      }),
      createSection('services', { title: 'Lo que ofrecemos', collection: { source: 'all', itemType: 'service' }, presentation: { layout: 'zigzag', imagePosition: 'alternate', shape: 'rounded' } }),
      createSection('features', {
        title: '¿Por qué elegirnos?',
        items: [
          { id: id(), icon: 'badge-check', title: 'Profesionales', text: 'Personal capacitado y con experiencia.' },
          { id: id(), icon: 'clock', title: 'Puntualidad', text: 'Llegamos a tiempo, siempre.' },
          { id: id(), icon: 'thumbs-up', title: 'Garantía', text: 'Si algo no queda bien, lo corregimos.' },
        ],
      }),
      cta('¿Listo para empezar?', 'Pide tu cotización sin compromiso.'),
      createSection('contact', { title: 'Contáctanos', layout: 'split' }),
    ],
  },
  about: {
    template: 'about',
    title: 'Nosotros',
    slug: 'nosotros',
    description: 'Historia, valores, galería y opiniones.',
    sections: ({ topic }) => [
      createSection('hero', { title: 'Quiénes somos', subtitle: topic ? `Pasión por ${topic}.` : 'Conoce nuestra historia.', height: 'sm' }),
      createSection('text', {
        eyebrow: 'Nuestra historia',
        title: 'Cómo empezamos',
        body: 'Cuéntale a tus clientes **quiénes son**, cómo empezaron y qué los hace diferentes.',
        imagePosition: 'right',
      }),
      createSection('features', {
        title: 'Nuestros valores',
        items: [
          { id: id(), icon: 'heart', title: 'Pasión', text: 'Amamos lo que hacemos.' },
          { id: id(), icon: 'handshake', title: 'Confianza', text: 'Relaciones a largo plazo con cada cliente.' },
          { id: id(), icon: 'leaf', title: 'Responsabilidad', text: 'Cuidamos a las personas y al entorno.' },
        ],
      }),
      createSection('gallery', { title: 'Galería', layout: 'masonry' }),
      createSection('testimonials', { title: 'Opiniones', layout: 'single', items: [{ id: id(), name: 'Cliente', text: 'Una experiencia excelente de principio a fin.', rating: 5 }] }),
    ],
  },
  contact: {
    template: 'contact',
    title: 'Contacto',
    slug: 'contacto',
    description: 'Datos de contacto, mapa y redes.',
    sections: () => [
      createSection('contact', { title: 'Contáctanos', subtitle: 'Estamos para ayudarte.', showMap: true }),
      createSection('social', { title: 'Síguenos' }),
    ],
  },
  promotions: {
    template: 'promotions',
    title: 'Promociones',
    slug: 'promociones',
    description: 'Banner, productos en oferta, novedades y llamado a la acción.',
    sections: () => [
      createSection('banner', { title: 'Promociones de la semana', subtitle: 'Aprovecha antes de que se agoten.', layout: 'full', height: 'md' }, { background: { type: 'gradient' }, textColor: 'light' }),
      createSection('products', { title: 'En oferta', collection: { source: 'sale', itemType: 'any', limit: 0 } }),
      createSection('products', { title: 'Novedades', collection: { source: 'new', itemType: 'any', limit: 8 } }),
      cta('¿Quieres apartar tu promoción?', 'Escríbenos y la separamos para ti.'),
    ],
  },
  gallery: {
    template: 'gallery',
    title: 'Galería',
    slug: 'galeria',
    description: 'Portafolio o fotos del lugar.',
    sections: () => [createSection('gallery', { title: 'Galería', layout: 'masonry' }), cta('¿Te gusta lo que ves?', 'Escríbenos para más información.')],
  },
  menu: {
    template: 'products',
    title: 'Menú',
    slug: 'menu',
    description: 'Carta con precios por categoría (restaurantes, cafeterías, servicios con tarifas).',
    sections: () => [
      createSection('hero', { title: 'Nuestro menú', subtitle: 'Preparado al momento.', height: 'sm' }),
      createSection('catalog', { title: '', presentation: { layout: 'priceList', columns: { desktop: 2, tablet: 2, mobile: 1 }, imageSize: 'sm', shape: 'circle' }, filters: { search: false, types: false, availability: false } }),
      createSection('contact', { title: 'Haz tu pedido', layout: 'centered' }),
    ],
  },
};
