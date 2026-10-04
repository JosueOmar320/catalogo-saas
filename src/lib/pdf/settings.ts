import { z } from 'zod';
import { collection, lenientCollectionSchema, SORT_OPTIONS } from '@/lib/catalog/collections';
import { lenientPresentationSchema, presentation, type Presentation, type ProductLayout } from '@/lib/catalog/presentation';
import { buildBackgroundSchema } from '@/lib/design/background';
import { fieldFactory, hexColor } from '@/lib/design/schema-utils';

/**
 * Configuración del PDF (catalogs.pdf), v2: constructor de catálogos por
 * BLOQUES. El PDF es otro destino de render del mismo sitio: usa el tema
 * (colores, fuentes, logo, fondo), los ítems, las colecciones y las
 * presentaciones de producto que también usa la web.
 *
 *   portada → índice → catálogo por categorías → colección → comparación →
 *   información → galería → página del sitio → contacto → salto de página
 *
 * Una plantilla es un PRESET: rellena portada, encabezado, pie, decoración y
 * presentación de cada bloque, y define detalles de estilo ("skin"). Después
 * todo se puede cambiar por separado.
 */

/* ------------------------------------------------------------ Plantillas */

export const PDF_TEMPLATES = ['commercial', 'catalog', 'editorial', 'minimal', 'brochure', 'technical', 'menu', 'modern', 'luxury', 'corporate', 'productBrochure'] as const;
export type PdfTemplateId = (typeof PDF_TEMPLATES)[number];

export const PDF_TEMPLATE_META: Record<PdfTemplateId, { label: string; description: string }> = {
  commercial: { label: 'Comercial', description: 'Portada con banda de color, ondas decorativas, precios destacados y pie con redes.' },
  catalog: { label: 'Catálogo clásico', description: 'Portada con foto, índice, categorías con imagen y cuadrícula de tarjetas.' },
  editorial: { label: 'Editorial', description: 'Como una revista: portada dividida, capítulos numerados y filas alternadas.' },
  minimal: { label: 'Minimal', description: 'Mucho aire, líneas finas y lista compacta con miniaturas.' },
  brochure: { label: 'Folleto de servicios', description: 'Portada a sangre, zigzag con imágenes en arco y pocas piezas por página.' },
  technical: { label: 'Ficha técnica', description: 'Fichas con especificaciones, códigos, tabla comparativa y numeración.' },
  menu: { label: 'Menú / Lista de precios', description: 'Dos columnas con puntos guía hasta el precio y ornamentos.' },
  modern: { label: 'Moderno', description: 'Bloques de color, etiquetas de categoría y precios en píldora.' },
  luxury: { label: 'Lujo', description: 'Marcos dobles, ornamentos y tipografía espaciada.' },
  corporate: { label: 'Corporativo', description: 'Sobrio y ordenado: banda de color, encabezado con logo, fichas con códigos y contraportada.' },
  productBrochure: { label: 'Folleto de producto', description: 'Pocos productos con mucho protagonismo: fotos grandes, página promocional y contraportada.' },
};

/* ------------------------------------------------------------ Opciones */

export const COVER_LAYOUTS = ['imageTop', 'fullImage', 'split', 'band', 'centered', 'framed', 'minimal'] as const;
export type CoverLayout = (typeof COVER_LAYOUTS)[number];
export const COVER_LAYOUT_LABELS: Record<CoverLayout, string> = {
  imageTop: 'Foto arriba',
  fullImage: 'Foto a sangre',
  split: 'Dividida',
  band: 'Banda de color',
  centered: 'Centrada',
  framed: 'Con marco',
  minimal: 'Sólo texto',
};

export const DECORATIONS = ['none', 'waves', 'blobs', 'lines', 'dots'] as const;
export const DECORATION_LABELS: Record<(typeof DECORATIONS)[number], string> = { none: 'Ninguna', waves: 'Ondas', blobs: 'Formas orgánicas', lines: 'Líneas', dots: 'Puntos' };

export const CATEGORY_STYLES = ['simple', 'image', 'hero', 'editorial'] as const;
export const CATEGORY_STYLE_LABELS: Record<(typeof CATEGORY_STYLES)[number], string> = {
  simple: 'Título simple',
  image: 'Banda con imagen',
  hero: 'Portada de categoría (página completa)',
  editorial: 'Capítulo numerado',
};

export const PDF_BLOCK_TYPES = ['cover', 'toc', 'catalog', 'products', 'comparison', 'text', 'gallery', 'image', 'promo', 'page', 'contact', 'backCover', 'pageBreak'] as const;
export type PdfBlockType = (typeof PDF_BLOCK_TYPES)[number];

export const PDF_BLOCK_META: Record<PdfBlockType, { label: string; description: string }> = {
  cover: { label: 'Portada', description: 'Primera página: logo, título, imagen y datos.' },
  toc: { label: 'Índice', description: 'Contenido con números de página y enlaces.' },
  catalog: { label: 'Catálogo por categorías', description: 'Todos los ítems agrupados por categoría.' },
  products: { label: 'Colección de productos', description: 'Destacados, ofertas, una marca, elegidos a mano…' },
  comparison: { label: 'Tabla comparativa', description: 'Compara ítems por precio y atributos.' },
  text: { label: 'Página de información', description: 'Texto libre con imagen: nosotros, políticas, garantía.' },
  gallery: { label: 'Galería', description: 'Fotos de tus ítems o imágenes propias.' },
  image: { label: 'Página de imagen', description: 'Una foto grande o a página completa, con texto opcional encima.' },
  promo: { label: 'Página promocional', description: 'Oferta o novedad destacada: titular, imagen, etiqueta de descuento y llamado a la acción.' },
  page: { label: 'Página del sitio', description: 'Una página de tu sitio adaptada a impresión.' },
  contact: { label: 'Contacto', description: 'Datos de contacto, redes y notas (formas de pago, políticas).' },
  backCover: { label: 'Contraportada', description: 'Última página: logo, mensaje de cierre y datos de contacto.' },
  pageBreak: { label: 'Salto de página', description: 'Lo que sigue empieza en una página nueva.' },
};

export const PDF_DENSITIES = ['compact', 'normal', 'airy'] as const;
export const PDF_DENSITY_LABELS: Record<(typeof PDF_DENSITIES)[number], string> = { compact: 'Compacto', normal: 'Normal', airy: 'Amplio' };

/* ------------------------------------------------------------ Esquemas */

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  const bool = (v: boolean) => f(z.boolean(), v);
  const text = (max: number) => f(z.string().trim().max(max), '');
  const color = f(z.union([z.literal(''), hexColor]), '');
  const pres = (defaults: Record<string, unknown>) => lenientPresentationSchema.catch(() => presentation(defaults)).prefault(defaults);
  const coll = (defaults: Record<string, unknown>) => lenientCollectionSchema.catch(() => collection(defaults)).prefault(defaults);
  const base = { id: z.string().min(1).max(64), enabled: bool(true), newPage: bool(true) };
  const heading = { title: text(120), subtitle: text(240) };

  const blocks = {
    cover: z.object({ ...base, type: z.literal('cover') }),
    toc: z.object({ ...base, type: z.literal('toc'), title: f(z.string().trim().max(80), 'Contenido'), showCategories: bool(true) }),
    catalog: z.object({
      ...base,
      type: z.literal('catalog'),
      ...heading,
      itemType: f(z.enum(['any', 'product', 'service']), 'any'),
      categoryIds: f(z.array(z.string().max(64)).max(100), []),
      categoryStyle: f(z.enum(CATEGORY_STYLES), 'simple'),
      categoryNewPage: bool(false),
      sort: f(z.enum(SORT_OPTIONS), 'custom'),
      presentation: pres({ layout: 'grid' }),
      itemsPerPage: f(z.number().int().min(0).max(60), 0),
    }),
    products: z.object({
      ...base,
      type: z.literal('products'),
      ...heading,
      collection: coll({ source: 'featured', limit: 0 }),
      presentation: pres({ layout: 'grid' }),
      itemsPerPage: f(z.number().int().min(0).max(60), 0),
    }),
    comparison: z.object({
      ...base,
      type: z.literal('comparison'),
      ...heading,
      collection: coll({ source: 'featured', limit: 4 }),
      attributeIds: f(z.array(z.string().max(40)).max(20), []),
      showImage: bool(true),
      showPrice: bool(true),
      showSku: bool(false),
    }),
    text: z.object({
      ...base,
      type: z.literal('text'),
      ...heading,
      body: f(z.string().max(6000), ''),
      imagePath: f(z.string().max(1000).nullable(), null),
      imagePosition: f(z.enum(['top', 'left', 'right', 'bottom']), 'right'),
    }),
    gallery: z.object({
      ...base,
      type: z.literal('gallery'),
      ...heading,
      source: f(z.enum(['items', 'custom']), 'items'),
      collection: coll({ source: 'all', limit: 12 }),
      images: f(z.array(z.object({ path: z.string().min(1).max(1000), caption: f(z.string().trim().max(120), '') })).max(40), []),
      columns: f(z.number().int().min(2).max(5), 3),
      shape: f(z.enum(['rect', 'rounded', 'circle', 'hexagon']), 'rounded'),
      captions: bool(true),
    }),
    image: z.object({
      ...base,
      type: z.literal('image'),
      ...heading,
      imagePath: f(z.string().max(1000).nullable(), null),
      /** Alto: página completa (a sangre), media página o un tercio. */
      size: f(z.enum(['full', 'half', 'third']), 'full'),
      fit: f(z.enum(['cover', 'contain']), 'cover'),
      textPosition: f(z.enum(['none', 'top', 'center', 'bottom']), 'bottom'),
      overlay: f(z.number().int().min(0).max(90), 35),
      caption: text(200),
    }),
    promo: z.object({
      ...base,
      type: z.literal('promo'),
      eyebrow: text(60),
      ...heading,
      body: f(z.string().max(1500), ''),
      badge: text(30),
      cta: text(80),
      imagePath: f(z.string().max(1000).nullable(), null),
      layout: f(z.enum(['split', 'fullImage', 'centered']), 'split'),
      background: buildBackgroundSchema(lenient).prefault({}),
      /** Productos destacados debajo (0 = ninguno). */
      collection: coll({ source: 'sale', limit: 0 }),
    }),
    page: z.object({ ...base, type: z.literal('page'), pageId: f(z.string().max(64), '') }),
    contact: z.object({
      ...base,
      newPage: bool(false),
      type: z.literal('contact'),
      title: f(z.string().trim().max(120), 'Contacto'),
      subtitle: text(240),
      notes: f(z.string().max(3000), ''),
      showSocial: bool(true),
    }),
    backCover: z.object({
      ...base,
      type: z.literal('backCover'),
      title: f(z.string().trim().max(120), 'Gracias'),
      message: text(400),
      showLogo: bool(true),
      showContact: bool(true),
      showSocial: bool(true),
      background: buildBackgroundSchema(lenient).prefault({}),
    }),
    pageBreak: z.object({ ...base, type: z.literal('pageBreak') }),
  } satisfies Record<PdfBlockType, z.ZodType>;

  const blockSchema = z.discriminatedUnion('type', [blocks.cover, blocks.toc, blocks.catalog, blocks.products, blocks.comparison, blocks.text, blocks.gallery, blocks.image, blocks.promo, blocks.page, blocks.contact, blocks.backCover, blocks.pageBreak]);
  // Leniente: un bloque inválido se descarta en lugar de invalidar todo el PDF.
  const blockList = lenient
    ? z.array(z.unknown()).catch([]).transform((list) => list.flatMap((b) => {
        const r = blockSchema.safeParse(b);
        return r.success ? [r.data] : [];
      }).slice(0, 40))
    : z.array(blockSchema).max(40);

  return z.object({
    version: z.literal(2).catch(2).prefault(2),
    template: f(z.enum(PDF_TEMPLATES), 'catalog'),
    paperSize: f(z.enum(['A4', 'LETTER', 'A5']), 'A4'),
    orientation: f(z.enum(['portrait', 'landscape']), 'portrait'),
    margins: f(z.enum(['small', 'medium', 'large', 'custom']), 'medium'),
    customMargin: f(z.number().min(5).max(40), 15),
    blocks: blockList.prefault([]),
    cover: z
      .object({
        layout: f(z.enum(COVER_LAYOUTS), 'imageTop'),
        eyebrow: text(80),
        title: text(120),
        subtitle: text(200),
        date: text(40),
        version: text(40),
        extraText: text(400),
        align: f(z.enum(['left', 'center']), 'left'),
        titleSize: f(z.enum(['md', 'lg', 'xl']), 'lg'),
        textColor: f(z.enum(['auto', 'light', 'dark']), 'auto'),
        showLogo: bool(true),
        showDescription: bool(true),
        showContact: bool(true),
        imageSource: f(z.enum(['cover', 'custom', 'none']), 'cover'),
        imagePath: f(z.string().max(1000).nullable(), null),
        imageShape: f(z.enum(['rect', 'rounded', 'circle', 'arch']), 'rect'),
        background: buildBackgroundSchema(lenient).prefault({}),
        decoration: f(z.enum(DECORATIONS), 'none'),
        sparkles: bool(false),
      })
      .prefault({}),
    header: z
      .object({
        style: f(z.enum(['none', 'line', 'band', 'title']), 'line'),
        showLogo: bool(true),
        showName: bool(true),
        showPageNumber: bool(false),
        text: text(80),
        color: color,
        /** Dónde va el logo/nombre: izquierda (texto a la derecha), centro o derecha. */
        align: f(z.enum(['left', 'center', 'right']), 'left'),
        /** Título de la sección actual (categoría o bloque) en el encabezado. */
        showSectionTitle: bool(false),
      })
      .prefault({}),
    footer: z
      .object({
        style: f(z.enum(['none', 'line', 'band']), 'line'),
        pageNumbers: f(z.enum(['none', 'simple', 'ofTotal']), 'ofTotal'),
        showPhone: bool(false),
        showWhatsapp: bool(true),
        showEmail: bool(false),
        showWebsite: bool(true),
        showSocial: bool(false),
        customText: text(160),
        showBusinessName: bool(false),
        align: f(z.enum(['spread', 'center']), 'spread'),
      })
      .prefault({}),
    decorations: z
      .object({
        corners: f(z.enum(DECORATIONS), 'none'),
        sparkles: bool(false),
        frame: bool(false),
        color: color,
      })
      .prefault({}),
    background: buildBackgroundSchema(lenient).prefault({}),
    /**
     * Estilo propio del PDF. Vacío = igual que el sitio: el PDF hereda la
     * identidad y sólo se cambia lo que el usuario (o Garfield) decida.
     */
    style: z
      .object({
        headingFont: text(40),
        bodyFont: text(40),
        /** Escala del texto respecto al sitio. */
        scale: f(z.number().min(0.8).max(1.3), 1),
        density: f(z.enum(PDF_DENSITIES), 'normal'),
        primary: color,
        accent: color,
        heading: color,
        text: color,
        uppercaseHeadings: f(z.enum(['inherit', 'yes', 'no']), 'inherit'),
      })
      .prefault({}),
    inkSaver: bool(false),
  });
}

export const pdfSettingsSchema = build(false);
const lenientPdfSettingsSchema = build(true);

export type PdfSettings = z.output<typeof pdfSettingsSchema>;
export type PdfSettingsInput = z.input<typeof pdfSettingsSchema>;
export type PdfBlock = PdfSettings['blocks'][number];
export type PdfBlockOf<T extends PdfBlockType> = Extract<PdfBlock, { type: T }>;

/* ------------------------------------------------------------ Presets (plantillas) */

type Preset = {
  cover: Partial<PdfSettings['cover']>;
  header: Partial<PdfSettings['header']>;
  footer: Partial<PdfSettings['footer']>;
  decorations: Partial<PdfSettings['decorations']>;
  /** Presentación sugerida para catálogos y colecciones. */
  presentation: Partial<Presentation> & { layout: ProductLayout };
  categoryStyle: PdfBlockOf<'catalog'>['categoryStyle'];
  itemsPerPage: number;
  /** Estilo propio (fuentes, densidad…). Si falta, la plantilla vuelve a heredar del sitio. */
  style?: Partial<PdfSettings['style']>;
};

const P = (p: Partial<Presentation> & { layout: ProductLayout }) => p;

export const TEMPLATE_PRESETS: Record<PdfTemplateId, Preset> = {
  commercial: {
    cover: { layout: 'band', align: 'left', titleSize: 'xl', decoration: 'waves', sparkles: true, imageShape: 'rounded' },
    header: { style: 'band' },
    footer: { style: 'band', showSocial: true },
    decorations: { corners: 'waves', sparkles: false, frame: false },
    presentation: P({ layout: 'grid', columns: { desktop: 4, tablet: 3, mobile: 2, pdf: 3 }, shape: 'rounded' }),
    categoryStyle: 'image',
    itemsPerPage: 0,
  },
  catalog: {
    cover: { layout: 'imageTop', align: 'left', titleSize: 'lg', decoration: 'none', sparkles: false },
    header: { style: 'line' },
    footer: { style: 'line' },
    decorations: { corners: 'none', sparkles: false, frame: false },
    presentation: P({ layout: 'grid', columns: { desktop: 4, tablet: 3, mobile: 2, pdf: 3 }, shape: 'rect' }),
    categoryStyle: 'image',
    itemsPerPage: 0,
  },
  editorial: {
    cover: { layout: 'split', align: 'left', titleSize: 'lg', decoration: 'none', sparkles: false },
    header: { style: 'title' },
    footer: { style: 'line' },
    decorations: { corners: 'none', sparkles: false, frame: false },
    presentation: P({ layout: 'zigzag', imagePosition: 'alternate', imageSize: 'md', shape: 'rect' }),
    categoryStyle: 'editorial',
    itemsPerPage: 0,
  },
  minimal: {
    cover: { layout: 'minimal', align: 'center', titleSize: 'md', decoration: 'none', sparkles: false },
    header: { style: 'none' },
    footer: { style: 'line', showWhatsapp: false },
    decorations: { corners: 'none', sparkles: false, frame: false },
    presentation: P({ layout: 'compactList', imageSize: 'sm', shape: 'rounded', separators: true }),
    categoryStyle: 'simple',
    itemsPerPage: 0,
  },
  brochure: {
    cover: { layout: 'fullImage', align: 'left', titleSize: 'xl', decoration: 'blobs', sparkles: true },
    header: { style: 'title' },
    footer: { style: 'band', showSocial: true },
    decorations: { corners: 'blobs', sparkles: true, frame: false },
    presentation: P({ layout: 'zigzag', imagePosition: 'alternate', imageSize: 'lg', shape: 'arch', frame: true, fields: { image: true, description: true, price: true, sku: false, category: false, badges: true, attributes: 'all', button: false, compareAt: true, discount: false, availability: true } }),
    categoryStyle: 'hero',
    itemsPerPage: 2,
  },
  technical: {
    cover: { layout: 'imageTop', align: 'left', titleSize: 'md', decoration: 'lines', sparkles: false },
    header: { style: 'line', showPageNumber: true },
    footer: { style: 'line', pageNumbers: 'ofTotal' },
    decorations: { corners: 'none', sparkles: false, frame: false },
    presentation: P({ layout: 'detail', imagePosition: 'left', shape: 'rect', fields: { image: true, description: true, price: true, sku: true, category: true, badges: false, attributes: 'all', button: false, compareAt: true, discount: false, availability: true } }),
    categoryStyle: 'simple',
    itemsPerPage: 2,
  },
  menu: {
    cover: { layout: 'centered', align: 'center', titleSize: 'xl', decoration: 'none', sparkles: false },
    header: { style: 'none' },
    footer: { style: 'line' },
    decorations: { corners: 'none', sparkles: false, frame: true },
    presentation: P({ layout: 'priceList', columns: { desktop: 2, tablet: 2, mobile: 1, pdf: 2 }, imageSize: 'sm', shape: 'circle', separators: false }),
    categoryStyle: 'simple',
    itemsPerPage: 0,
  },
  modern: {
    cover: { layout: 'band', align: 'left', titleSize: 'xl', decoration: 'dots', sparkles: false, imageShape: 'rounded' },
    header: { style: 'line' },
    footer: { style: 'line' },
    decorations: { corners: 'dots', sparkles: false, frame: false },
    presentation: P({ layout: 'grid', columns: { desktop: 4, tablet: 3, mobile: 2, pdf: 3 }, shape: 'rounded' }),
    categoryStyle: 'simple',
    itemsPerPage: 0,
  },
  luxury: {
    cover: { layout: 'framed', align: 'center', titleSize: 'lg', decoration: 'none', sparkles: false },
    header: { style: 'title', align: 'center' },
    footer: { style: 'line', align: 'center' },
    decorations: { corners: 'none', sparkles: false, frame: true },
    presentation: P({ layout: 'grid', columns: { desktop: 3, tablet: 2, mobile: 2, pdf: 2 }, shape: 'rect', frame: false, align: 'center' }),
    categoryStyle: 'editorial',
    itemsPerPage: 0,
    style: { headingFont: 'playfair', bodyFont: 'lora', density: 'airy', uppercaseHeadings: 'yes', accent: '#B08D57' },
  },
  corporate: {
    cover: { layout: 'band', align: 'left', titleSize: 'lg', decoration: 'lines', sparkles: false, imageShape: 'rect' },
    header: { style: 'line', align: 'left', showSectionTitle: true },
    footer: { style: 'line', pageNumbers: 'ofTotal', showBusinessName: true, showWebsite: true },
    decorations: { corners: 'none', sparkles: false, frame: false },
    presentation: P({ layout: 'compactGrid', columns: { desktop: 4, tablet: 3, mobile: 2, pdf: 4 }, shape: 'rect', fields: { image: true, description: true, price: true, sku: true, category: false, badges: false, attributes: 'card', button: false, compareAt: true, discount: false, availability: true } }),
    categoryStyle: 'simple',
    itemsPerPage: 0,
    style: { headingFont: 'montserrat', bodyFont: 'inter', density: 'compact' },
  },
  productBrochure: {
    cover: { layout: 'fullImage', align: 'left', titleSize: 'xl', decoration: 'none', sparkles: false },
    header: { style: 'none' },
    footer: { style: 'line', align: 'center' },
    decorations: { corners: 'none', sparkles: false, frame: false },
    presentation: P({ layout: 'largeCards', columns: { desktop: 2, tablet: 2, mobile: 1, pdf: 2 }, imageSize: 'lg', ratio: 'portrait', shape: 'rounded', fields: { image: true, description: true, price: true, sku: false, category: false, badges: true, attributes: 'card', button: false, compareAt: true, discount: true, availability: true } }),
    categoryStyle: 'hero',
    itemsPerPage: 4,
    style: { density: 'airy', scale: 1.08 },
  },
};

/** Aplica una plantilla: estilo de portada, encabezado, pie, decoración y presentación de los bloques. */
export function applyTemplate(settings: PdfSettings, id: PdfTemplateId): PdfSettings {
  const preset = TEMPLATE_PRESETS[id];
  const pres = (current: Presentation) => presentation({ ...current, ...preset.presentation, columns: { ...current.columns, ...preset.presentation.columns }, fields: { ...current.fields, ...preset.presentation.fields } });
  return {
    ...settings,
    template: id,
    cover: { ...settings.cover, ...preset.cover },
    header: { ...settings.header, ...preset.header },
    footer: { ...settings.footer, ...preset.footer },
    decorations: { ...settings.decorations, ...preset.decorations },
    // La plantilla define su tipografía y densidad; los colores propios del usuario se conservan.
    style: { ...settings.style, headingFont: '', bodyFont: '', scale: 1, density: 'normal', uppercaseHeadings: 'inherit', ...preset.style },
    blocks: settings.blocks.map((b) => {
      if (b.type === 'catalog') return { ...b, presentation: pres(b.presentation), categoryStyle: preset.categoryStyle, itemsPerPage: preset.itemsPerPage };
      if (b.type === 'products') return { ...b, presentation: pres(b.presentation), itemsPerPage: preset.itemsPerPage };
      return b;
    }),
  };
}

/** Nuevo bloque con valores por defecto (y la presentación de la plantilla actual). */
export function createPdfBlock(type: PdfBlockType, template: PdfTemplateId, extra: Record<string, unknown> = {}): PdfBlock {
  const preset = TEMPLATE_PRESETS[template];
  const id = `${type}-${Math.random().toString(36).slice(2, 9)}`;
  const withPres = type === 'catalog' || type === 'products' ? { presentation: preset.presentation, itemsPerPage: preset.itemsPerPage } : {};
  const withCat = type === 'catalog' ? { categoryStyle: preset.categoryStyle } : {};
  const title = { products: 'Destacados', comparison: 'Comparativa', text: 'Sobre nosotros', gallery: 'Galería', promo: 'Oferta especial', backCover: 'Gracias', image: '' }[type as string] ?? '';
  const parsed = lenientPdfSettingsSchema.parse({ blocks: [{ id, type, title, ...withPres, ...withCat, ...extra }] }).blocks[0];
  return parsed ?? { id, type: 'pageBreak', enabled: true, newPage: true };
}

/* ------------------------------------------------------------ Lectura y migración */

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

const V1_TEMPLATE: Record<string, PdfTemplateId> = { classic: 'catalog', modern: 'modern', editorial: 'editorial', minimal: 'minimal', luxury: 'luxury', menu: 'menu' };
const V1_LAYOUT: Record<string, ProductLayout> = { classic: 'grid', modern: 'grid', luxury: 'grid', editorial: 'zigzag', minimal: 'compactList', menu: 'priceList' };
const V1_COVER: Record<string, CoverLayout> = { classic: 'imageTop', modern: 'band', editorial: 'split', minimal: 'minimal', luxury: 'framed', menu: 'centered' };

/** PDF v1 (content[] + products) → v2 (bloques + presentación). */
function migrateV1(v1: Obj): Obj {
  const oldTemplate = String(v1.template ?? 'classic');
  const template = V1_TEMPLATE[oldTemplate] ?? 'catalog';
  const products = obj(v1.products);
  const header = obj(v1.header);
  const footer = obj(v1.footer);
  const imageSize = String(products.imageSize ?? 'md');
  const pres = {
    ...TEMPLATE_PRESETS[template].presentation,
    layout: V1_LAYOUT[oldTemplate] ?? 'grid',
    columns: { desktop: 4, tablet: 3, mobile: 2, pdf: Number(products.columns ?? 3) || 3 },
    imageSize: imageSize === 'none' ? 'md' : imageSize,
    fields: {
      image: imageSize !== 'none',
      description: products.showDescription !== false,
      price: products.showPrice !== false,
      sku: products.showSku === true,
      category: products.showCategory === true,
      badges: products.showBadges !== false,
      attributes: 'none',
      button: false,
    },
  };
  const filter = String(v1.catalogFilter ?? 'all');
  const content = Array.isArray(v1.content) ? (v1.content as Obj[]) : [{ id: 'cover', type: 'cover' }, { id: 'catalog', type: 'catalog' }, { id: 'contact', type: 'contact' }];
  const blocks = content.map((b, index) => {
    const common = { id: String(b.id ?? `b${index}`), enabled: b.enabled !== false };
    if (b.type === 'catalog')
      return {
        ...common,
        type: 'catalog',
        newPage: index > 0,
        itemType: filter === 'products' ? 'product' : filter === 'services' ? 'service' : 'any',
        categoryNewPage: products.pageBreakPerCategory === true,
        categoryStyle: 'simple',
        presentation: pres,
      };
    if (b.type === 'page') return { ...common, type: 'page', pageId: b.pageId };
    if (b.type === 'contact') return { ...common, type: 'contact', newPage: false };
    return { ...common, type: 'cover' };
  });
  return {
    ...v1,
    version: 2,
    template,
    blocks,
    cover: { ...obj(v1.cover), layout: V1_COVER[oldTemplate] ?? 'imageTop', align: ['minimal', 'luxury', 'menu'].includes(oldTemplate) ? 'center' : 'left' },
    header: { ...header, style: header.enabled === false ? 'none' : oldTemplate === 'luxury' ? 'title' : 'line' },
    footer: { ...footer, style: footer.enabled === false ? 'none' : 'line' },
    decorations: { frame: oldTemplate === 'luxury' || oldTemplate === 'menu' },
  };
}

/** Configuración de un catálogo sin PDF guardado: portada, índice, catálogo y contacto. */
export function defaultPdfSettings(template: PdfTemplateId = 'catalog'): PdfSettings {
  const base = lenientPdfSettingsSchema.parse({
    template,
    blocks: [
      { id: 'cover', type: 'cover' },
      { id: 'toc', type: 'toc' },
      { id: 'catalog', type: 'catalog' },
      { id: 'contact', type: 'contact' },
    ],
  });
  return applyTemplate(base, template);
}

/**
 * Lee la configuración guardada. Acepta v2, v1 (content[]) y, si el catálogo
 * aún no tiene `pdf`, las opciones de settings.pdf de la primera versión.
 */
export function parsePdfSettings(raw: unknown, legacy?: unknown): PdfSettings {
  const value = obj(raw);
  if (Object.keys(value).length > 0) {
    return lenientPdfSettingsSchema.parse(value.version === 2 || Array.isArray(value.blocks) ? value : migrateV1(value));
  }
  const old = obj(legacy);
  if (Object.keys(old).length === 0) return defaultPdfSettings();
  return lenientPdfSettingsSchema.parse(
    migrateV1({
      template: old.layout === 'list' ? 'minimal' : 'classic',
      paperSize: old.paperSize,
      content: [
        { id: 'cover', type: 'cover', enabled: old.includeCover !== false },
        { id: 'catalog', type: 'catalog', enabled: true },
        { id: 'contact', type: 'contact', enabled: true },
      ],
      products: { showPrice: old.showPrices, showDescription: old.showDescriptions, pageBreakPerCategory: old.pageBreakPerCategory },
    }),
  );
}
