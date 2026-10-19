import { contactSchema } from '@/lib/business/profile';
import { catalogSettingsSchema, seoSchema } from '@/lib/catalog/settings';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { env } from '@/lib/env';
import { applyPreset, getPreset } from '@/lib/design/presets';
import { DEFAULT_THEME, type ThemeConfig } from '@/lib/design/theme';
import { formatPrice } from '@/lib/utils/format';
import type { ItemType } from '@/types/database';
import { navigationFromPages } from './navigation';
import { newPage, type SitePage } from './pages';
import { createSection } from './section-schemas';
import type { SiteViewModel } from './view-model';

/**
 * Sitio de ejemplo: alimenta la demo, la landing, el onboarding y la preview
 * del builder cuando el catálogo todavía no tiene ítems.
 * Usa URLs absolutas de imágenes (sólo permitidas en datos de ejemplo).
 */
const photo = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

const CATEGORIES = [
  { id: '00000000-0000-4000-8000-00000000c001', name: 'Café de especialidad', description: 'Granos de origen único, tostados cada semana.', imageUrl: photo('1509042239860-f550ce710b93', 800) },
  { id: '00000000-0000-4000-8000-00000000c002', name: 'Panadería', description: 'Horneado todas las mañanas.', imageUrl: photo('1509440159596-0249088772ff', 800) },
  { id: '00000000-0000-4000-8000-00000000c003', name: 'Eventos y cursos', description: 'Llevamos la experiencia a tu evento o empresa.', imageUrl: photo('1511920170033-f8396924c348', 800) },
];

type SampleItem = {
  name: string;
  type?: ItemType;
  category: number;
  short: string;
  price: number | null;
  compareAt?: number;
  note?: string;
  photo?: string;
  featured?: boolean;
  available?: boolean;
  sku?: string;
  badges?: CatalogItemView['badges'];
  attrs?: CatalogItemView['attributes'];
  /** Opciones con precio propio (null = precio del producto). */
  variants?: { label: string; options: [name: string, price: number | null][] };
};

const ITEMS: SampleItem[] = [
  { name: 'Espresso doble', category: 0, short: 'Intenso, con notas a cacao y frutos rojos.', price: 45, photo: '1510591509098-f4fdc6d0ff04', featured: true, sku: 'CAF-001', badges: ['popular'], attrs: { origen: 'Chiapas', tamano: '2 oz' } },
  { name: 'Latte de avena', category: 0, short: 'Espresso con bebida de avena texturizada.', price: 68, photo: '1461023058943-07fcbe16d735', sku: 'CAF-002', note: 'desde', badges: ['new'], attrs: { origen: 'Veracruz', tamano: '12 oz' }, variants: { label: 'Tamaño', options: [['12 oz', null], ['16 oz', 78]] } },
  { name: 'Cold brew', category: 0, short: 'Extracción en frío por 18 horas. Suave y dulce.', price: 72, compareAt: 85, photo: '1517701604599-bb29b565090c', featured: true, sku: 'CAF-003', attrs: { origen: 'Chiapas', tamano: '16 oz' } },
  { name: 'Café en grano 340 g', category: 0, short: 'Chiapas, lavado. Ideal para filtrado.', price: 290, photo: '1559056199-641a0ac8b55e', sku: 'CAF-010', note: 'bolsa', featured: true, attrs: { origen: 'Chiapas', tamano: '340 g', incluye: ['Molienda a elección', 'Fecha de tueste en la bolsa'] } },
  { name: 'Croissant de mantequilla', category: 1, short: 'Hojaldre francés con 27 capas.', price: 48, photo: '1555507036-ab1f4038808a', featured: true, sku: 'PAN-001', badges: ['popular'] },
  { name: 'Pan de masa madre', category: 1, short: 'Fermentación lenta de 36 horas.', price: 120, photo: '1509440159596-0249088772ff', sku: 'PAN-002' },
  { name: 'Rol de canela', category: 1, short: 'Con glaseado de queso crema.', price: 55, photo: '1509365465985-25d11c17e812', available: false, sku: 'PAN-003' },
  { name: 'Catering para eventos', type: 'service', category: 2, short: 'Barra de café móvil con barista para tu evento.', price: 4500, note: 'desde', photo: '1511920170033-f8396924c348', attrs: { duracion: 4, incluye: ['Barista profesional', 'Máquina de espresso', '100 bebidas'] } },
  { name: 'Taller de barismo', type: 'service', category: 2, short: 'Aprende extracción y arte latte en 3 horas.', price: 950, note: 'por persona', photo: '1442512595331-e89e73853f31', badges: ['new'], attrs: { duracion: 3, incluye: ['Materiales', 'Certificado'] } },
  { name: 'Café para oficinas', type: 'service', category: 2, short: 'Suscripción mensual con entrega y mantenimiento.', price: null },
];

function sampleItems(currency: string, url: string): CatalogItemView[] {
  return ITEMS.map((item, index) => ({
    id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
    slug: `ejemplo-${index + 1}`,
    type: item.type ?? 'product',
    name: item.name,
    shortDescription: item.short,
    description: `${item.short}\n\nEste es un ítem de ejemplo. Cuando agregues tus productos y servicios aparecerán aquí.`,
    price: item.price,
    compareAtPrice: item.compareAt ?? null,
    currency,
    priceLabel: item.price === null ? null : formatPrice(item.price, currency),
    compareAtLabel: item.compareAt ? formatPrice(item.compareAt, currency) : null,
    priceNote: item.note ?? null,
    sku: item.sku ?? null,
    isAvailable: item.available ?? true,
    isFeatured: item.featured ?? false,
    tags: [],
    categoryId: CATEGORIES[item.category].id,
    images: item.photo ? [{ url: photo(item.photo), thumbUrl: photo(item.photo, 480), width: 1200, height: 1200, alt: item.name }] : [],
    badges: item.badges ?? [],
    customBadge: null,
    attributes: item.attrs ?? {},
    createdAt: new Date(2026, 0, 30 - index).toISOString(),
    // Como en un sitio real: cada ítem con su propia URL (compartir, WhatsApp, SEO).
    url: `${url}/p/ejemplo-${index + 1}`,
    saleEndsOn: null,
    variants: item.variants
      ? {
          label: item.variants.label,
          options: item.variants.options.map(([name, price], i) => {
            const value = price ?? item.price;
            return { id: `v${i + 1}`, name, price: value, priceLabel: value === null ? null : formatPrice(value, currency), sku: null, available: true };
          }),
        }
      : null,
  }));
}

/** Ids fijos: el sitio de ejemplo se construye igual en servidor y cliente (sin errores de hidratación). */
const pid = (n: number) => `00000000-0000-4000-8000-0000000a000${n}`;

export function buildSamplePages(): SitePage[] {

  const menu = newPage('Menú', 'menu', [createSection('catalog', { title: 'Nuestro menú', subtitle: 'Todo se prepara al momento.', filters: { price: true, badges: true }, pagination: { mode: 'loadMore', perPage: 12 } })], 'products', pid(2));
  const events = newPage(
    'Eventos',
    'eventos',
    [
      createSection('services', { title: 'Eventos y cursos', subtitle: 'Cotiza sin compromiso.', collection: { source: 'all', itemType: 'service' }, presentation: { layout: 'zigzag', imagePosition: 'alternate', shape: 'arch', frame: true, fields: { attributes: 'all' } } }),
      createSection('testimonials', {
        title: 'Lo que dicen nuestros clientes',
        layout: 'single',
        items: [{ id: 't4', name: 'Laura M.', role: 'Boda en Coyoacán', text: 'La barra de café fue lo más comentado de la noche. Puntuales y muy amables.', rating: 5 }],
      }),
    ],
    'services',
    pid(3),
  );
  const about = newPage(
    'Nosotros',
    'nosotros',
    [
      createSection('text', {
        eyebrow: 'Desde 2016',
        title: 'Café hecho con cuidado',
        body: 'Empezamos como un pequeño carrito en el mercado. Hoy tostamos **cada semana** granos de pequeños productores de Chiapas y Veracruz.\n\n- Relación directa con productores\n- Tueste propio\n- Pan de masa madre hecho en casa',
        image: { path: photo('1442512595331-e89e73853f31') },
        imagePosition: 'right',
      }),
      createSection('gallery', {
        title: 'Nuestro espacio',
        layout: 'masonry',
        images: ['1495474472287-4d71bcdd2085', '1509042239860-f550ce710b93', '1511920170033-f8396924c348', '1555507036-ab1f4038808a', '1461023058943-07fcbe16d735', '1509440159596-0249088772ff'].map((id) => ({ path: photo(id, 900), caption: '' })),
      }),
    ],
    'about',
    pid(4),
  );
  const contact = newPage('Contacto', 'contacto', [createSection('contact', { title: 'Visítanos', subtitle: 'Te esperamos con un café recién hecho.', showMap: true })], 'contact', pid(5));

  const home = {
    ...newPage(
      'Inicio',
      'inicio',
      [
        createSection(
          'hero',
          {
            eyebrow: 'Cafetería y panadería',
            layout: 'centered',
            height: 'lg',
            primaryButton: { label: 'Ver el menú', link: { kind: 'page', pageId: menu.id } },
            secondaryButton: { label: 'WhatsApp', variant: 'secondary', icon: 'message-circle', link: { kind: 'whatsapp' } },
          },
          {
            background: { type: 'image', image: { path: photo('1495474472287-4d71bcdd2085', 2000) }, overlay: { color: '#000000', opacity: 50 } },
            textColor: 'light',
          },
        ),
        createSection('features', {
          items: [
            { id: 'f1', icon: 'coffee', title: 'Tueste propio', text: 'Granos frescos cada semana.' },
            { id: 'f2', icon: 'leaf', title: 'Origen local', text: 'Directo de productores mexicanos.' },
            { id: 'f3', icon: 'truck', title: 'Entrega a domicilio', text: 'En la zona centro, sin costo.' },
          ],
        }),
        createSection('products', {
          eyebrow: 'Favoritos',
          title: 'Lo más pedido',
          collection: { source: 'featured', limit: 4 },
          presentation: { layout: 'grid', columns: { desktop: 4, tablet: 2, mobile: 2 } },
          button: { label: 'Ver todo el menú', variant: 'secondary', link: { kind: 'page', pageId: menu.id } },
        }),
        createSection('categories', { title: 'Explora', display: 'imageText', columns: { desktop: 3, tablet: 3, mobile: 1 }, linkPageId: menu.id }),
        createSection(
          'banner',
          {
            eyebrow: 'Eventos',
            title: 'Lleva nuestra barra de café a tu evento',
            subtitle: 'Bodas, oficinas y lanzamientos. Cotiza en minutos.',
            layout: 'full',
            height: 'md',
            button: { label: 'Cotizar ahora', icon: 'message-circle', link: { kind: 'whatsapp', message: 'Hola, quiero cotizar la barra de café para un evento.' } },
          },
          { background: { type: 'image', image: { path: photo('1511920170033-f8396924c348', 1800) }, overlay: { color: '#2B1D14', opacity: 60 } }, textColor: 'light' },
        ),
        createSection('testimonials', {
          title: 'Clientes felices',
          items: [
            { id: 't1', name: 'Andrea R.', role: 'Clienta frecuente', text: 'El mejor cold brew de la ciudad y el pan siempre recién hecho.', rating: 5 },
            { id: 't2', name: 'Jorge P.', role: 'Oficina Roma Norte', text: 'Su suscripción para oficinas nos cambió las mañanas.', rating: 5 },
            { id: 't3', name: 'Sofía L.', role: 'Taller de barismo', text: 'Aprendí muchísimo y me llevé mi primer latte art.', rating: 4 },
          ],
        }),
        createSection('contact', { title: 'Visítanos', layout: 'split' }),
      ],
      'home',
      pid(1),
    ),
    isHome: true,
  };
  // Ids de sección deterministas (ninguna referencia apunta a ellos).
  let seq = 0;
  return [home, menu, events, about, contact].map((page) => ({
    ...page,
    sections: page.sections.map((section) => ({ ...section, id: `00000000-0000-4000-8000-0000000b${String(++seq).padStart(4, '0')}` })),
  }));
}

type SampleOptions = {
  theme?: ThemeConfig;
  businessName?: string;
  slogan?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  pages?: SitePage[];
};

export function buildSampleSite(options: SampleOptions = {}): SiteViewModel {
  const settings = catalogSettingsSchema.parse({ currency: 'MXN', contactActions: { phone: { enabled: true } }, order: { enabled: true, pickup: true, delivery: true, deliveryFee: 35, freeDeliveryFrom: 300, deliveryNote: 'Zona centro, 30–45 min', payments: ['cash', 'card', 'transfer'] } });
  const url = `${env.siteUrl}/demo`;
  const pages = options.pages ?? buildSamplePages();
  return {
    business: {
      name: options.businessName ?? 'Café Aurora',
      slug: 'demo',
      description: options.description === undefined ? 'Cafetería de especialidad y panadería artesanal en el corazón de la ciudad.' : options.description,
      slogan: options.slogan === undefined ? 'Café recién tostado, pan recién horneado.' : options.slogan,
      logoUrl: options.logoUrl ?? null,
      contact: contactSchema.parse({
        whatsapp: '+52 55 1234 5678',
        phone: '+52 55 1234 5678',
        email: 'hola@cafeaurora.mx',
        address: 'Av. Álvaro Obregón 120',
        city: 'Ciudad de México',
        hours: 'Días festivos: 9:00 – 14:00',
        schedule: {
          enabled: true,
          timezone: 'America/Mexico_City',
          days: [
            ...Array.from({ length: 5 }, () => ({ open: true, ranges: [{ from: '07:30', to: '20:00' }] })),
            ...Array.from({ length: 2 }, () => ({ open: true, ranges: [{ from: '08:30', to: '18:00' }] })),
          ],
        },
      }),
      socialLinks: [
        { network: 'instagram', url: 'https://instagram.com' },
        { network: 'facebook', url: 'https://facebook.com' },
      ],
    },
    theme: options.theme ?? applyPreset(DEFAULT_THEME, getPreset('restaurant')),
    settings,
    seo: seoSchema.parse({}),
    coverUrl: photo('1495474472287-4d71bcdd2085', 1800),
    faviconUrl: null,
    categories: CATEGORIES,
    items: sampleItems(settings.currency, url),
    attributeDefs: [
      { id: 'origen', name: 'Origen', type: 'select', unit: '', options: ['Chiapas', 'Veracruz', 'Oaxaca'], filterable: true, showInCard: true, showInDetail: true, showInPdf: true },
      { id: 'tamano', name: 'Tamaño', type: 'text', unit: '', options: [], filterable: false, showInCard: true, showInDetail: true, showInPdf: true },
      { id: 'duracion', name: 'Duración', type: 'number', unit: 'h', options: [], filterable: false, showInCard: true, showInDetail: true, showInPdf: true },
      { id: 'incluye', name: 'Incluye', type: 'list', unit: '', options: [], filterable: false, showInCard: false, showInDetail: true, showInPdf: true },
    ],
    pages,
    navigation: navigationFromPages(pages),
    showBranding: true,
    url,
    publishedAt: null,
  };
}
