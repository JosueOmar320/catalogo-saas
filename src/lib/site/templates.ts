import { applyPreset, getPreset } from '@/lib/design/presets';
import type { ThemeConfig } from '@/lib/design/theme';
import { PAGE_BLUEPRINT_DEFS, type PageBlueprintId } from './blueprints';
import { columnPreset } from './column-presets';
import { navigationFromPages, type NavigationConfig } from './navigation';
import { newPage, type SitePage } from './pages';
import { artDirect } from './art-direction';
import { withBrandGradients } from './resolve';
import { createSection, type Section } from './section-schemas';

/**
 * Plantillas de SITIO = tema (preset) + páginas + secciones + contenido
 * inicial. No hay componentes propios de cada plantilla: todo son secciones
 * existentes (incluida Columnas) con textos de ejemplo. Las usan el editor
 * ("Plantillas") y Garfield ("quiero una web elegante para un restaurante").
 */

export const SITE_TEMPLATE_IDS = ['restaurant', 'corporate', 'services', 'store', 'productCatalog', 'portfolio', 'agency', 'landing', 'minimal', 'elegant'] as const;
export type SiteTemplateId = (typeof SITE_TEMPLATE_IDS)[number];

type Ctx = { topic: string; pageIds: Record<string, string> };
type TemplatePage = { key: string; title: string; slug: string; template: SitePage['template']; sections: (ctx: Ctx) => Section[] } | { key: string; blueprint: PageBlueprintId };

type SiteTemplate = { label: string; description: string; preset: string; pages: TemplatePage[] };

const whatsapp = (label = 'Escríbenos por WhatsApp') => ({ label, icon: 'message-circle', link: { kind: 'whatsapp' } });
const toPage = (pageId: string | undefined, label: string) => (pageId ? { label, link: { kind: 'page', pageId }, variant: 'secondary' } : { label, link: { kind: 'none' }, variant: 'secondary' });
const of = (topic: string) => (topic ? ` de ${topic}` : '');
const testimonials = () =>
  createSection('testimonials', {
    title: 'Lo que dicen nuestros clientes',
    items: [
      { id: crypto.randomUUID(), name: 'Mariana G.', text: 'Excelente atención y muy buena calidad. Volvería sin pensarlo.', rating: 5 },
      { id: crypto.randomUUID(), name: 'Carlos R.', text: 'Rápidos, puntuales y muy amables. Totalmente recomendados.', rating: 5 },
      { id: crypto.randomUUID(), name: 'Lucía M.', text: 'Superaron lo que esperaba. Se nota el cuidado en cada detalle.', rating: 5 },
    ],
  });
const contact = (title = 'Contáctanos') => createSection('contact', { title, subtitle: 'Escríbenos y te respondemos en minutos.', showMap: true });
const cta = (title: string, subtitle: string) => createSection('columns', { ...columnPreset('ctaButtons', { title, text: subtitle }) }, { background: { type: 'gradient' }, textColor: 'light' });
const stats = () => createSection('columns', columnPreset('stats'), { background: { type: 'color', color: '#F6F2EC' } });
const steps = (title = '¿Cómo trabajamos?') => createSection('columns', { title, ...columnPreset('steps') });

export const SITE_TEMPLATES: Record<SiteTemplateId, SiteTemplate> = {
  restaurant: {
    label: 'Restaurante',
    description: 'Portada con foto, categorías, platos destacados, menú con precios, galería, opiniones y ubicación.',
    preset: 'restaurant',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ topic, pageIds }) => [
          createSection('hero', { title: 'Sabores que se recuerdan', subtitle: `Cocina${of(topic) || ' casera'} preparada al momento.`, height: 'lg', layout: 'centered', primaryButton: { label: 'Ver el menú', link: { kind: 'page', pageId: pageIds.menu } }, secondaryButton: { ...whatsapp('Reservar'), variant: 'secondary' } }, { background: { type: 'gradient' }, textColor: 'light' }),
          createSection('categories', { title: 'Nuestra carta' }),
          createSection('products', { eyebrow: 'Favoritos de la casa', title: 'Platos destacados', collection: { source: 'featured', itemType: 'any', limit: 6 }, presentation: { layout: 'imageFocus', columns: { desktop: 3, tablet: 2, mobile: 1 } } }),
          createSection('columns', columnPreset('imageText', { title: 'Una mesa para compartir', text: 'Ingredientes frescos, recetas de la casa y un lugar pensado para disfrutar sin prisa.' })),
          createSection('gallery', { title: 'El lugar', layout: 'masonry' }),
          testimonials(),
          contact('Visítanos'),
        ],
      },
      { key: 'menu', blueprint: 'menu' },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
  corporate: {
    label: 'Corporativo',
    description: 'Empresa seria y confiable: nosotros, cifras, servicios, equipo, clientes, opiniones y contacto.',
    preset: 'corporate',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ topic, pageIds }) => [
          createSection('hero', { title: `Soluciones${of(topic) || ' profesionales'} para tu empresa`, subtitle: 'Experiencia, compromiso y resultados medibles.', layout: 'split', height: 'lg', primaryButton: whatsapp('Agenda una reunión'), secondaryButton: toPage(pageIds.services, 'Nuestros servicios') }),
          createSection('columns', columnPreset('textImage', { title: 'Quiénes somos', text: 'Somos un equipo con años de experiencia ayudando a empresas a crecer con soluciones a la medida.' })),
          stats(),
          createSection('services', { title: 'Servicios', collection: { source: 'all', itemType: 'service', limit: 6 } }),
          createSection('team', { title: 'Nuestro equipo' }),
          createSection('logos', { title: 'Confían en nosotros' }),
          testimonials(),
          contact(),
        ],
      },
      { key: 'services', blueprint: 'services' },
      { key: 'about', blueprint: 'about' },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
  services: {
    label: 'Servicios profesionales',
    description: 'Servicios, por qué elegirnos, proceso de trabajo, opiniones, equipo y llamado a la acción.',
    preset: 'modern',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ topic }) => [
          createSection('hero', { title: `Servicios${of(topic) || ' profesionales'} sin complicaciones`, subtitle: 'Te asesoramos y lo resolvemos por ti, con garantía.', height: 'lg', layout: 'left', primaryButton: whatsapp('Pide tu cotización') }),
          createSection('services', { title: 'Qué hacemos', collection: { source: 'all', itemType: 'service', limit: 6 } }),
          createSection('columns', columnPreset('benefitsImage', { title: 'Trabajo bien hecho, a tiempo' })),
          steps(),
          testimonials(),
          createSection('team', { title: 'El equipo' }),
          cta('¿Listo para empezar?', 'Cuéntanos qué necesitas y te enviamos una propuesta hoy mismo.'),
        ],
      },
      { key: 'services', blueprint: 'services' },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
  store: {
    label: 'Tienda',
    description: 'Estilo e-commerce: portada, categorías, destacados, ofertas, todos los productos y newsletter.',
    preset: 'colorful',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ pageIds }) => [
          createSection('hero', { title: 'Lo nuevo ya llegó', subtitle: 'Descubre los productos de la temporada.', height: 'md', layout: 'split', primaryButton: { label: 'Ver productos', link: { kind: 'page', pageId: pageIds.products } } }),
          createSection('categories', { title: 'Compra por categoría' }),
          createSection('products', { eyebrow: 'Lo más vendido', title: 'Destacados', collection: { source: 'featured', itemType: 'product', limit: 8 } }),
          createSection('banner', { title: 'Ofertas de la semana', subtitle: 'Precios especiales por tiempo limitado.', layout: 'boxed', button: { label: 'Ver ofertas', link: { kind: 'page', pageId: pageIds.promotions } } }, { background: { type: 'gradient' }, textColor: 'light' }),
          createSection('products', { title: 'En oferta', collection: { source: 'sale', itemType: 'product', limit: 4 }, presentation: { fields: { discount: true } } }),
          createSection('columns', columnPreset('threeCards')),
          cta('Recibe nuestras novedades', 'Escríbenos por WhatsApp y te avisamos de cada lanzamiento.'),
        ],
      },
      { key: 'products', blueprint: 'products' },
      { key: 'promotions', blueprint: 'promotions' },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
  productCatalog: {
    label: 'Catálogo de productos',
    description: 'Catálogo completo con buscador y filtros, destacados y contacto. Ideal para distribuidores.',
    preset: 'minimal',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ topic }) => [
          createSection('hero', { title: `Catálogo${of(topic)}`, subtitle: 'Consulta precios, características y disponibilidad.', height: 'sm' }),
          createSection('products', { title: 'Destacados', collection: { source: 'featured', itemType: 'any', limit: 8 }, presentation: { layout: 'compactGrid', columns: { desktop: 5, tablet: 3, mobile: 2 } } }),
          createSection('catalog', { title: 'Todos los productos' }),
          contact('¿Tienes dudas? Escríbenos'),
        ],
      },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
  portfolio: {
    label: 'Portafolio',
    description: 'Trabajos en galería, sobre mí, servicios y contacto. Para fotógrafos, diseñadores y artistas.',
    preset: 'fashion',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ topic }) => [
          createSection('hero', { title: 'Hola, este es mi trabajo', subtitle: `Proyectos${of(topic)} hechos con dedicación.`, height: 'md', layout: 'left' }),
          createSection('gallery', { title: 'Trabajos recientes', layout: 'masonry' }),
          createSection('columns', columnPreset('imageText', { title: 'Sobre mí', text: 'Cuenta tu historia, tu estilo y qué te hace diferente.' })),
          createSection('services', { title: 'Servicios', collection: { source: 'all', itemType: 'service', limit: 4 } }),
          testimonials(),
          contact('Trabajemos juntos'),
        ],
      },
      { key: 'gallery', blueprint: 'gallery' },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
  agency: {
    label: 'Agencia',
    description: 'Moderno y audaz: propuesta de valor, servicios en tarjetas, proceso, cifras, clientes y CTA.',
    preset: 'dark',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: () => [
          createSection('hero', { title: 'Hacemos crecer marcas', subtitle: 'Estrategia, diseño y contenido que convierten.', height: 'screen', layout: 'centered', primaryButton: whatsapp('Hablemos'), secondaryButton: { label: 'Ver servicios', link: { kind: 'none' }, variant: 'secondary' } }),
          createSection('columns', { title: 'Lo que hacemos', ...columnPreset('threeCards') }),
          steps('Nuestro proceso'),
          stats(),
          createSection('logos', { title: 'Marcas con las que trabajamos' }),
          testimonials(),
          cta('¿Tienes un proyecto en mente?', 'Cuéntanos y armamos una propuesta en 48 horas.'),
        ],
      },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
  landing: {
    label: 'Landing page',
    description: 'Una sola página para vender algo: hero, beneficios, imagen + texto, opiniones, precios, CTA y contacto.',
    preset: 'modern',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ topic }) => [
          createSection('hero', { title: topic ? `La mejor opción en ${topic}` : 'Tu propuesta en una frase', subtitle: 'Explica en una línea el beneficio principal.', height: 'lg', layout: 'split', primaryButton: whatsapp('Lo quiero') }),
          createSection('features', { title: 'Beneficios' }),
          createSection('columns', columnPreset('imageText')),
          testimonials(),
          createSection('pricing', {
            title: 'Planes',
            plans: [
              { id: crypto.randomUUID(), name: 'Básico', price: '$199', period: '/mes', features: ['Beneficio 1', 'Beneficio 2'] },
              { id: crypto.randomUUID(), name: 'Pro', price: '$399', period: '/mes', features: ['Todo lo del Básico', 'Beneficio extra'], highlighted: true, badge: 'Más elegido' },
            ],
          }),
          createSection('faq', { title: 'Preguntas frecuentes', items: [{ id: crypto.randomUUID(), question: '¿Cómo empiezo?', answer: 'Escríbenos por WhatsApp y te guiamos.' }, { id: crypto.randomUUID(), question: '¿Formas de pago?', answer: 'Efectivo, transferencia y tarjeta.' }] }),
          cta('Empieza hoy', 'Te respondemos en minutos.'),
          contact(),
        ],
      },
    ],
  },
  minimal: {
    label: 'Minimal',
    description: 'Pocas secciones, mucho aire: portada, texto, productos y contacto.',
    preset: 'minimal',
    pages: [{ key: 'home', blueprint: 'home' }, { key: 'products', blueprint: 'products' }, { key: 'contact', blueprint: 'contact' }],
  },
  elegant: {
    label: 'Elegante',
    description: 'Tipografía con serifa y tonos sobrios: portada, historia, destacados, galería y contacto.',
    preset: 'elegant',
    pages: [
      {
        key: 'home',
        title: 'Inicio',
        slug: 'inicio',
        template: 'home',
        sections: ({ topic }) => [
          createSection('hero', { title: 'Detalles que hacen la diferencia', subtitle: topic ? `${topic[0].toUpperCase()}${topic.slice(1)} con estilo propio.` : 'Calidad y estilo en cada detalle.', height: 'lg', layout: 'centered' }),
          createSection('columns', columnPreset('imageText', { title: 'Nuestra historia', text: 'Cuenta cómo empezó todo y qué cuidas en cada pieza o servicio.' })),
          createSection('products', { eyebrow: 'Selección', title: 'Lo más especial', collection: { source: 'featured', itemType: 'any', limit: 6 }, presentation: { layout: 'largeCards', columns: { desktop: 3, tablet: 2, mobile: 1 } } }),
          createSection('gallery', { title: 'Galería', layout: 'grid' }),
          testimonials(),
          contact(),
        ],
      },
      { key: 'products', blueprint: 'products' },
      { key: 'contact', blueprint: 'contact' },
    ],
  },
};

/** Palabras que eligen la plantilla en los pedidos ("una web para mi restaurante"). */
export const SITE_TEMPLATE_WORDS: [string[], SiteTemplateId][] = [
  [['restaurante', 'cafeteria', 'comida', 'bar', 'pizzeria', 'panaderia', 'cocina'], 'restaurant'],
  [['corporativ', 'empresa', 'consultora', 'despacho', 'arquitectura', 'constructora'], 'corporate'],
  [['agencia', 'marketing', 'estudio creativo'], 'agency'],
  [['portafolio', 'portfolio', 'fotografo', 'disenador', 'artista'], 'portfolio'],
  [['tienda', 'ecommerce', 'e-commerce', 'boutique', 'ropa'], 'store'],
  [['catalogo', 'distribuidor', 'mayorista', 'repuestos'], 'productCatalog'],
  [['landing', 'una sola pagina', 'pagina de venta'], 'landing'],
  [['servicios', 'limpieza', 'taller', 'clinica', 'salon', 'spa', 'abogado', 'plomeria'], 'services'],
  [['elegante', 'lujo', 'joyeria'], 'elegant'],
  [['minimal', 'sencilla', 'simple'], 'minimal'],
];

export type TemplateResult = { theme: ThemeConfig; pages: SitePage[]; navigation: NavigationConfig; removedPageIds: string[] };

/**
 * Aplica una plantilla. `replace`: el sitio queda sólo con las páginas de la
 * plantilla (las anteriores se eliminan al guardar). `add`: agrega las
 * páginas que no existen (por slug) y conserva todo lo demás.
 */
export function applySiteTemplate(current: { theme: ThemeConfig; pages: SitePage[]; navigation: NavigationConfig }, id: SiteTemplateId, options: { mode?: 'replace' | 'add'; topic?: string; keepTheme?: boolean } = {}): TemplateResult {
  const template = SITE_TEMPLATES[id];
  const mode = options.mode ?? 'replace';
  const topic = (options.topic ?? '').trim().slice(0, 80);
  const pageIds: Record<string, string> = Object.fromEntries(template.pages.map((p) => [p.key, crypto.randomUUID()]));
  const ctx: Ctx = { topic, pageIds };
  const built = template.pages.map((p, index) => {
    const pageId = pageIds[p.key];
    if ('blueprint' in p) {
      const def = PAGE_BLUEPRINT_DEFS[p.blueprint];
      const page = newPage(def.title, def.slug, def.sections({ topic: topic || undefined, catalogPageId: pageIds.products ?? pageIds.menu }), def.template, pageId);
      return { ...page, isHome: index === 0 };
    }
    return { ...newPage(p.title, p.slug, p.sections(ctx), p.template, pageId), isHome: index === 0 };
  });
  const theme = options.keepTheme ? current.theme : applyPreset(current.theme, getPreset(template.preset));
  // Degradados "de marca" con los colores del tema final.
  for (const page of built) page.sections = artDirect(withBrandGradients(page.sections, theme), theme, 'balanced');

  if (mode === 'replace') {
    return { theme, pages: built, navigation: navigationFromPages(built), removedPageIds: current.pages.map((p) => p.id) };
  }
  const taken = new Set(current.pages.map((p) => p.slug));
  const added = built.filter((p) => !taken.has(p.slug)).map((p) => ({ ...p, isHome: false }));
  const navigation = { items: [...current.navigation.items, ...navigationFromPages(added).items] };
  return { theme, pages: [...current.pages, ...added], navigation, removedPageIds: [] };
}
