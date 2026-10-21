import { PAGE_BLUEPRINT_DEFS } from './blueprints';
import { navigationFromPages, type NavigationConfig } from './navigation';
import { newPage, type SitePage } from './pages';
import { createSection, type Section } from './section-schemas';

/** Qué ofrece el negocio; 'website' = sitio web sin catálogo (sin páginas ni secciones de productos). */
export type BusinessOffering = 'products' | 'services' | 'both' | 'website';

/**
 * Sitio inicial para negocios nuevos. Es contenido editable, no una
 * plantilla fija: el usuario puede cambiar, ocultar o borrar todo.
 */
export function buildStarterSite(offering: BusinessOffering): { pages: SitePage[]; navigation: NavigationConfig } {
  if (offering === 'website') return buildWebsiteStarter();
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

/** Plantillas para "Nueva página" en el builder (las mismas que usa Garfield AI). */
export const PAGE_BLUEPRINTS = (['blank', 'home', 'products', 'services', 'menu', 'promotions', 'about', 'gallery', 'contact'] as const).map((id) => {
  const bp = PAGE_BLUEPRINT_DEFS[id];
  return { ...bp, sections: () => bp.sections({}) };
});

/**
 * Sitio web sin catálogo (portafolio, organización, evento…): portada,
 * "Nosotros" y "Contacto", con textos de ejemplo para reemplazar.
 */
function buildWebsiteStarter(): { pages: SitePage[]; navigation: NavigationConfig } {
  const about = newPage(
    'Nosotros',
    'nosotros',
    [
      createSection('hero', { title: 'Quiénes somos', subtitle: 'Nuestra historia, en pocas palabras.', height: 'sm' }),
      createSection('text', {
        title: 'Nuestra historia',
        body: 'Cuenta **quiénes son**, cómo empezaron y qué los mueve.\n\n- Qué hacen\n- Para quién lo hacen\n- Por qué confiar en ustedes',
        imagePosition: 'none',
      }),
    ],
    'about',
  );
  const contact = newPage('Contacto', 'contacto', [createSection('contact', { title: 'Contáctanos', subtitle: 'Escríbenos y te respondemos pronto.', showMap: true })], 'contact');
  const home = {
    ...newPage(
      'Inicio',
      'inicio',
      [
        createSection('hero', {
          height: 'md',
          primaryButton: { label: 'Conócenos', link: { kind: 'page', pageId: about.id } },
          secondaryButton: { label: 'Contacto', variant: 'secondary', link: { kind: 'page', pageId: contact.id } },
        }),
        createSection('features', {
          title: 'Lo que hacemos',
          items: [
            { id: crypto.randomUUID(), icon: 'sparkles', title: 'Primer punto', text: 'Describe en una línea algo que haces o que te distingue.' },
            { id: crypto.randomUUID(), icon: 'users', title: 'Segundo punto', text: 'Para quién es o cómo trabajas.' },
            { id: crypto.randomUUID(), icon: 'award', title: 'Tercer punto', text: 'Un logro, un valor o una garantía.' },
          ],
        }),
        createSection('banner', {
          title: '¿Hablamos?',
          subtitle: 'Cuéntanos qué necesitas.',
          button: { label: 'Ir a contacto', link: { kind: 'page', pageId: contact.id } },
        }),
      ],
      'home',
    ),
    isHome: true,
  };
  const pages = [home, about, contact];
  return { pages, navigation: navigationFromPages(pages) };
}
