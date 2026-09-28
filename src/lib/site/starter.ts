import { navigationFromPages, type NavigationConfig } from './navigation';
import { newPage, type SitePage } from './pages';
import { createSection, type Section } from './section-schemas';

export type BusinessOffering = 'products' | 'services' | 'both';

/**
 * Sitio inicial para negocios nuevos. Es contenido editable, no una
 * plantilla fija: el usuario puede cambiar, ocultar o borrar todo.
 */
export function buildStarterSite(offering: BusinessOffering): { pages: SitePage[]; navigation: NavigationConfig } {
  const sellsProducts = offering !== 'services';
  const sellsServices = offering !== 'products';

  const products = sellsProducts
    ? newPage('Productos', 'productos', [createSection('catalog', { title: 'Nuestros productos', itemType: 'product' })], 'products')
    : null;
  const services = sellsServices
    ? newPage(
        'Servicios',
        'servicios',
        [
          createSection('services', { title: 'Servicios', subtitle: 'Cuéntanos lo que necesitas y te enviamos una cotización.', source: 'all' }),
          createSection('banner', {
            title: '¿Tienes dudas?',
            subtitle: 'Escríbenos y te respondemos en minutos.',
            button: { label: 'Escribir por WhatsApp', icon: 'message-circle', link: { kind: 'whatsapp' } },
          }),
        ],
        'services',
      )
    : null;
  const about = newPage(
    'Nosotros',
    'nosotros',
    [
      createSection('text', {
        title: 'Nuestra historia',
        body: 'Cuéntale a tus clientes **quiénes son**, cómo empezaron y qué los hace diferentes.\n\n- Qué ofrecen\n- A quién ayudan\n- Por qué elegirlos',
        imagePosition: 'none',
      }),
    ],
    'about',
  );
  const contact = newPage(
    'Contacto',
    'contacto',
    [createSection('contact', { title: 'Contáctanos', subtitle: 'Estamos para ayudarte.', showMap: true })],
    'contact',
  );

  const mainPage = products ?? services!;
  const homeSections: Section[] = [
    createSection('hero', {
      height: 'md',
      primaryButton: { label: sellsProducts ? 'Ver productos' : 'Ver servicios', link: { kind: 'page', pageId: mainPage.id } },
      secondaryButton: { label: 'WhatsApp', variant: 'secondary', icon: 'message-circle', link: { kind: 'whatsapp' } },
    }),
    createSection('features', {
      items: [
        { id: crypto.randomUUID(), icon: 'message-circle', title: 'Atención directa', text: 'Resolvemos tus dudas por WhatsApp.' },
        { id: crypto.randomUUID(), icon: 'shield-check', title: 'Calidad garantizada', text: 'Trabajamos con los mejores materiales.' },
        { id: crypto.randomUUID(), icon: 'truck', title: 'Entregas', text: 'Consulta envíos y tiempos de entrega.' },
      ],
    }),
  ];
  if (sellsProducts) {
    homeSections.push(
      createSection('products', {
        title: 'Destacados',
        source: 'featured',
        limit: 8,
        button: { label: 'Ver todos', variant: 'secondary', link: { kind: 'page', pageId: products!.id } },
      }),
      createSection('categories', { title: 'Categorías', linkPageId: products!.id }),
    );
  }
  if (sellsServices) {
    homeSections.push(createSection('services', { title: 'Servicios', source: 'all', limit: 4 }));
  }
  homeSections.push(createSection('contact', { title: 'Visítanos', layout: 'split' }));

  const home = { ...newPage('Inicio', 'inicio', homeSections, 'home'), isHome: true };
  const pages = [home, products, services, about, contact].filter((p): p is SitePage => p !== null);
  return { pages, navigation: navigationFromPages(pages) };
}

/** Plantillas para "Nueva página" en el builder. */
export const PAGE_BLUEPRINTS: { template: SitePage['template']; title: string; slug: string; description: string; sections: () => Section[] }[] = [
  { template: 'custom', title: 'Página en blanco', slug: 'nueva-pagina', description: 'Empieza desde cero.', sections: () => [createSection('text', { title: 'Título de la página' })] },
  { template: 'products', title: 'Productos', slug: 'productos', description: 'Catálogo con buscador y categorías.', sections: () => [createSection('catalog', { title: 'Productos', itemType: 'product' })] },
  { template: 'services', title: 'Servicios', slug: 'servicios', description: 'Lista de servicios con botón de contacto.', sections: () => [createSection('services', { title: 'Servicios' })] },
  {
    template: 'promotions',
    title: 'Promociones',
    slug: 'promociones',
    description: 'Banner + productos en oferta.',
    sections: () => [
      createSection('banner', { title: 'Promociones de la semana', layout: 'full', height: 'md' }, { background: { type: 'gradient' } }),
      createSection('products', { title: 'En oferta', source: 'all' }),
    ],
  },
  { template: 'about', title: 'Nosotros', slug: 'nosotros', description: 'Historia, equipo y galería.', sections: () => [createSection('text', { title: 'Quiénes somos' }), createSection('gallery', { title: 'Galería' })] },
  { template: 'gallery', title: 'Galería', slug: 'galeria', description: 'Portafolio o fotos del lugar.', sections: () => [createSection('gallery', { title: 'Galería', layout: 'masonry' })] },
  { template: 'contact', title: 'Contacto', slug: 'contacto', description: 'Datos de contacto y mapa.', sections: () => [createSection('contact', { title: 'Contacto', showMap: true })] },
];

/**
 * Página de inicio equivalente a la v1 (hero + catálogo completo + contacto).
 * Red de seguridad si un catálogo aún no tiene páginas guardadas; la
 * migración SQL crea la misma estructura de forma permanente.
 */
export function buildFallbackHome(hasCover: boolean, coverPath: string | null): SitePage {
  const sections: Section[] = [
    ...(hasCover
      ? [createSection('hero', { height: 'md' }, { background: { type: 'image', image: { path: coverPath }, overlay: { color: '#000000', opacity: 45 } }, textColor: 'light' }, 'fallback-hero')]
      : []),
    createSection('catalog', {}, {}, 'fallback-catalog'),
    createSection('contact', {}, {}, 'fallback-contact'),
  ];
  return { ...newPage('Inicio', 'inicio', sections, 'home', '00000000-0000-4000-8000-00000000f001'), isHome: true };
}
