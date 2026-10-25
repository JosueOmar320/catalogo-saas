import { z } from 'zod';
import { buildBackgroundSchema } from '@/lib/design/background';
import { ICON_IDS } from '@/lib/design/icons';
import { fieldFactory, hexColor } from '@/lib/design/schema-utils';
import { collectionSchema, lenientCollectionSchema, SORT_OPTIONS } from '@/lib/catalog/collections';
import { lenientPresentationSchema, presentationSchema } from '@/lib/catalog/presentation';
import { MAX_EMBED_LENGTH, MAX_HTML_LENGTH } from './custom-code-config';

/**
 * Secciones de página. Cada tipo = schema de contenido con defaults.
 * Se guardan como JSONB dentro de catalog_pages.sections:
 *   agregar un tipo nuevo = agregar su schema aquí + su renderer (web/PDF)
 *   + su editor. Ninguna migración de base de datos.
 */
export const SECTION_TYPES = [
  'hero',
  'text',
  'products',
  'services',
  'product',
  'catalog',
  'categories',
  'banner',
  'gallery',
  'features',
  'testimonials',
  'contact',
  'social',
  'spacer',
  'image',
  'video',
  'faq',
  'pricing',
  'team',
  'stats',
  'logos',
  'columns',
  'quickorder',
  'table',
  'html',
  'embed',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/** Cómo se ve la sección Producto: foto y ficha lado a lado, foto de fondo o tarjeta. */
export const PRODUCT_SPOTLIGHT_LAYOUTS = ['split', 'banner', 'card'] as const;

/** Tope de la sección Tabla (lo respetan el editor, Garfield y el guardado). */
export const TABLE_MAX_COLUMNS = 10;
export const TABLE_MAX_ROWS = 60;

/** Distribuciones de la sección Columnas (fracciones del ancho). */
export const COLUMN_LAYOUTS = ['1', '1-1', '1-2', '2-1', '1-3', '3-1', '1-1-1', '1-2-1', '1-1-1-1'] as const;
export type ColumnLayout = (typeof COLUMN_LAYOUTS)[number];
export const columnCount = (layout: ColumnLayout) => layout.split('-').length;

/** Bloques que se pueden poner dentro de una columna. */
export const COLUMN_BLOCK_KINDS = ['heading', 'text', 'image', 'buttons', 'list', 'card', 'icon', 'badge', 'stat', 'divider', 'spacer', 'video'] as const;
export type ColumnBlockKind = (typeof COLUMN_BLOCK_KINDS)[number];

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  const bool = (v: boolean) => f(z.boolean(), v);
  const text = (max: number, v = '') => f(z.string().max(max), v);
  const uuidOrEmpty = f(z.union([z.literal(''), z.uuid()]), '');
  const image = z.object({ path: f(z.string().max(1000).nullable(), null) }).prefault({});
  const columns = (desktop: number, tablet: number, mobile: number) =>
    z
      .object({
        desktop: f(z.number().int().min(1).max(6), desktop),
        tablet: f(z.number().int().min(1).max(4), tablet),
        mobile: f(z.number().int().min(1).max(2), mobile),
      })
      .prefault({});

  /** Destino de un enlace o botón. */
  const link = z
    .object({
      kind: f(z.enum(['none', 'page', 'url', 'whatsapp', 'phone', 'email']), 'none'),
      pageId: uuidOrEmpty,
      url: text(500),
      message: text(300),
      newTab: bool(false),
    })
    .prefault({});

  const button = z
    .object({
      label: text(40),
      link,
      variant: f(z.enum(['primary', 'secondary']), 'primary'),
      icon: f(z.union([z.literal(''), z.enum(ICON_IDS)]), ''),
    })
    .prefault({});

  const coll = (defaults: Record<string, unknown>) => (lenient ? lenientCollectionSchema : collectionSchema).prefault(defaults as never);
  const pres = (defaults: Record<string, unknown>) => (lenient ? lenientPresentationSchema : presentationSchema).prefault(defaults as never);

  const divider = z
    .object({
      shape: f(z.enum(['none', 'wave', 'curve', 'slant', 'zigzag', 'triangle']), 'none'),
      color: f(z.union([z.literal(''), hexColor]), ''),
      height: f(z.enum(['sm', 'md', 'lg']), 'md'),
      flip: bool(false),
    })
    .prefault({});

  const style = z
    .object({
      background: buildBackgroundSchema(lenient).prefault({}),
      textColor: f(z.enum(['auto', 'light', 'dark']), 'auto'),
      paddingTop: f(z.enum(['default', 'none', 'sm', 'md', 'lg', 'xl', 'custom']), 'default'),
      paddingBottom: f(z.enum(['default', 'none', 'sm', 'md', 'lg', 'xl', 'custom']), 'default'),
      /** Relleno exacto en px (cuando paddingTop/paddingBottom = 'custom'). */
      paddingTopPx: f(z.number().int().min(0).max(400), 64),
      paddingBottomPx: f(z.number().int().min(0).max(400), 64),
      width: f(z.enum(['narrow', 'contained', 'wide', 'full']), 'contained'),
      /* Diseño */
      minHeight: f(z.enum(['auto', 'sm', 'md', 'lg', 'screen']), 'auto'),
      verticalAlign: f(z.enum(['top', 'center', 'bottom']), 'center'),
      textAlign: f(z.enum(['inherit', 'left', 'center', 'right']), 'inherit'),
      /* Espaciado exterior: separación con la sección anterior o superposición sobre ella. */
      marginTop: f(z.enum(['none', 'sm', 'md', 'lg']), 'none'),
      overlap: f(z.enum(['none', 'sm', 'md', 'lg']), 'none'),
      /* Apariencia: la sección como tarjeta (caja), borde, radio y sombra. */
      boxed: bool(false),
      border: z
        .object({
          width: f(z.number().int().min(0).max(8), 0),
          color: f(z.union([z.literal(''), hexColor]), ''),
          radius: f(z.number().int().min(0).max(48), 0),
        })
        .prefault({}),
      shadow: f(z.enum(['none', 'soft', 'medium', 'strong']), 'none'),
      /* Divisores decorativos entre secciones. */
      dividerTop: divider,
      dividerBottom: divider,
      /** Animación de entrada al hacer scroll (sólo CSS; sin movimiento si el visitante lo pidió). */
      animation: f(z.enum(['none', 'fade', 'up', 'zoom', 'left', 'right', 'blur', 'flip']), 'none'),
      hideOnMobile: bool(false),
      hideOnTablet: bool(false),
      hideOnDesktop: bool(false),
      anchor: f(z.string().regex(/^[a-z0-9-]*$/).max(40), ''),
      /** Ajustes para tablets (inherit = como en escritorio). Los celulares heredan de aquí. */
      tablet: z
        .object({
          paddingTop: f(z.enum(['inherit', 'none', 'sm', 'md', 'lg']), 'inherit'),
          paddingBottom: f(z.enum(['inherit', 'none', 'sm', 'md', 'lg']), 'inherit'),
          textAlign: f(z.enum(['inherit', 'left', 'center']), 'inherit'),
        })
        .prefault({}),
      /** Ajustes sólo para celulares (inherit = como en tablet, o en escritorio). */
      mobile: z
        .object({
          paddingTop: f(z.enum(['inherit', 'none', 'sm', 'md', 'lg']), 'inherit'),
          paddingBottom: f(z.enum(['inherit', 'none', 'sm', 'md', 'lg']), 'inherit'),
          textAlign: f(z.enum(['inherit', 'left', 'center']), 'inherit'),
        })
        .prefault({}),
    })
    .prefault({});

  /* ---------------- Bloques de la sección Columnas */
  const blockBase = { id: z.string().min(1).max(64) };
  const columnBlock = z.discriminatedUnion('kind', [
    z.object({ ...blockBase, kind: z.literal('heading'), eyebrow: text(80), text: text(200), level: f(z.enum(['h2', 'h3', 'h4']), 'h2') }),
    z.object({ ...blockBase, kind: z.literal('text'), body: text(4000), size: f(z.enum(['sm', 'md', 'lg']), 'md') }),
    z.object({ ...blockBase, kind: z.literal('image'), image, alt: text(200), ratio: f(z.enum(['original', 'square', 'landscape', 'portrait', 'wide']), 'landscape'), rounded: bool(true), shadow: bool(false) }),
    z.object({ ...blockBase, kind: z.literal('buttons'), items: f(z.array(button).max(4), []) }),
    z.object({
      ...blockBase,
      kind: z.literal('list'),
      items: f(z.array(z.object({ id: z.string().max(64), text: text(240), icon: f(z.union([z.literal(''), z.enum(ICON_IDS)]), '') })).max(20), []),
      marker: f(z.enum(['icon', 'bullet', 'number', 'check']), 'check'),
    }),
    z.object({
      ...blockBase,
      kind: z.literal('card'),
      icon: f(z.union([z.literal(''), z.enum(ICON_IDS)]), ''),
      image,
      title: text(120),
      text: text(600),
      button,
    }),
    z.object({ ...blockBase, kind: z.literal('icon'), icon: f(z.enum(ICON_IDS), 'star'), size: f(z.enum(['sm', 'md', 'lg']), 'md'), shape: f(z.enum(['none', 'circle', 'square']), 'circle') }),
    z.object({ ...blockBase, kind: z.literal('badge'), text: text(40), tone: f(z.enum(['accent', 'primary', 'neutral']), 'accent') }),
    z.object({ ...blockBase, kind: z.literal('stat'), value: text(24), label: text(80) }),
    z.object({ ...blockBase, kind: z.literal('divider') }),
    z.object({ ...blockBase, kind: z.literal('spacer'), size: f(z.enum(['sm', 'md', 'lg']), 'md') }),
    z.object({ ...blockBase, kind: z.literal('video'), url: f(z.union([z.literal(''), z.url({ protocol: /^https$/ }).max(500)]), ''), ratio: f(z.enum(['16:9', '4:3', '1:1']), '16:9') }),
  ]);
  // Leniente: un bloque inválido se descarta en lugar de invalidar toda la sección.
  const blockList = lenient
    ? z.array(z.unknown()).catch([]).transform((list) => list.flatMap((b) => {
        const r = columnBlock.safeParse(b);
        return r.success ? [r.data] : [];
      }).slice(0, 12))
    : z.array(columnBlock).max(12);
  const column = z.object({
    id: z.string().min(1).max(64),
    blocks: blockList.prefault([]),
    align: f(z.enum(['left', 'center', 'right']), 'left'),
    /** Columna como tarjeta. */
    surface: f(z.enum(['none', 'card', 'soft', 'outline']), 'none'),
    padding: f(z.enum(['none', 'sm', 'md', 'lg']), 'none'),
  });

  const base = <T extends SectionType, C extends z.ZodType>(type: T, content: C) =>
    z.object({
      id: z.string().min(1).max(64),
      type: z.literal(type),
      visible: bool(true),
      name: text(60),
      content: content.prefault({} as never),
      style,
    });

  const heading = { eyebrow: text(80), title: text(160), subtitle: text(500) };

  const sections = {
    hero: base(
      'hero',
      z.object({
        ...heading,
        layout: f(z.enum(['centered', 'left', 'split']), 'centered'),
        height: f(z.enum(['sm', 'md', 'lg', 'screen']), 'md'),
        image: image,
        videoUrl: f(z.union([z.literal(''), z.url().max(500)]), ''),
        showLogo: bool(false),
        primaryButton: button,
        secondaryButton: button,
      }),
    ),
    text: base(
      'text',
      z.object({
        ...heading,
        body: text(8000),
        image: image,
        imagePosition: f(z.enum(['none', 'left', 'right', 'top']), 'none'),
        alignment: f(z.enum(['left', 'center']), 'left'),
        width: f(z.enum(['narrow', 'normal', 'wide']), 'normal'),
        button,
      }),
    ),
    products: base(
      'products',
      z.object({
        ...heading,
        collection: coll({ source: 'featured', itemType: 'product', limit: 8 }),
        presentation: pres({ layout: 'grid' }),
        button,
      }),
    ),
    services: base(
      'services',
      z.object({
        ...heading,
        collection: coll({ source: 'all', itemType: 'service' }),
        presentation: pres({ layout: 'zigzag', imageSize: 'md', shape: 'rounded' }),
        button,
      }),
    ),
    product: base(
      'product',
      z.object({
        /** Vacíos: la categoría, el nombre y la descripción corta del producto. */
        ...heading,
        /** '' = automático: el primer destacado (o el primero del catálogo). */
        itemId: f(z.union([z.literal(''), z.uuid()]), ''),
        layout: f(z.enum(PRODUCT_SPOTLIGHT_LAYOUTS), 'split'),
        /** Lado de la foto (en el banner, que la lleva de fondo: lado del texto). */
        imageSide: f(z.enum(['left', 'right']), 'left'),
        gallery: bool(true),
        showDescription: bool(true),
        showSpecs: bool(true),
        showBadges: bool(true),
        /** Variantes, extras y botón para pedir o consultar. */
        showOrder: bool(true),
        showDetailsLink: bool(true),
      }),
    ),
    catalog: base(
      'catalog',
      z.object({
        ...heading,
        itemType: f(z.enum(['any', 'product', 'service']), 'any'),
        presentation: pres({ layout: 'grid', columns: { desktop: 3, tablet: 3, mobile: 2 } }),
        groupByCategory: bool(true),
        showFeatured: bool(true),
        filters: z
          .object({
            search: bool(true),
            categories: bool(true),
            types: bool(true),
            price: bool(false),
            badges: bool(false),
            availability: bool(true),
            /** Filtros por atributo: si la lista está vacía, todos los atributos marcados como filtrables. */
            byAttributes: bool(true),
            attributes: f(z.array(z.string().max(40)).max(10), []),
          })
          .prefault({}),
        sort: z
          .object({
            default: f(z.enum(SORT_OPTIONS), 'custom'),
            allowUserSort: bool(true),
          })
          .prefault({}),
        pagination: z
          .object({
            mode: f(z.enum(['all', 'pages', 'loadMore', 'infinite']), 'all'),
            perPage: f(z.number().int().min(4).max(100), 24),
          })
          .prefault({}),
      }),
    ),
    categories: base(
      'categories',
      z.object({
        ...heading,
        display: f(z.enum(['cards', 'grid', 'list', 'imageText']), 'cards'),
        categoryIds: f(z.array(z.uuid()).max(100), []),
        columns: columns(4, 3, 2),
        showDescription: bool(true),
        showCount: bool(true),
        linkPageId: uuidOrEmpty,
      }),
    ),
    banner: base(
      'banner',
      z.object({
        ...heading,
        layout: f(z.enum(['full', 'boxed', 'split']), 'boxed'),
        alignment: f(z.enum(['left', 'center']), 'center'),
        height: f(z.enum(['sm', 'md', 'lg']), 'sm'),
        image: image,
        button,
      }),
    ),
    gallery: base(
      'gallery',
      z.object({
        ...heading,
        images: f(z.array(z.object({ path: z.string().max(1000), caption: text(160) })).max(40), []),
        layout: f(z.enum(['grid', 'masonry', 'slider']), 'grid'),
        ratio: f(z.enum(['square', 'landscape', 'portrait', 'original']), 'square'),
        columns: columns(3, 3, 2),
        gap: f(z.enum(['none', 'sm', 'md']), 'sm'),
      }),
    ),
    features: base(
      'features',
      z.object({
        ...heading,
        items: f(
          z.array(z.object({ id: z.string().max(64), icon: f(z.enum(ICON_IDS), 'star'), title: text(80), text: text(300) })).max(24),
          [],
        ),
        layout: f(z.enum(['grid', 'list', 'inline']), 'grid'),
        iconStyle: f(z.enum(['plain', 'circle', 'square']), 'circle'),
        alignment: f(z.enum(['left', 'center']), 'center'),
        columns: columns(3, 3, 1),
      }),
    ),
    testimonials: base(
      'testimonials',
      z.object({
        ...heading,
        items: f(
          z
            .array(
              z.object({
                id: z.string().max(64),
                name: text(80),
                role: text(80),
                text: text(600),
                photo: f(z.string().max(1000).nullable(), null),
                rating: f(z.number().int().min(0).max(5), 5),
              }),
            )
            .max(24),
          [],
        ),
        layout: f(z.enum(['grid', 'slider', 'single']), 'grid'),
        /** "Escritos por ti" (los de arriba) o las reseñas de clientes aprobadas en el panel. */
        source: f(z.enum(['manual', 'reviews']), 'manual'),
        columns: columns(3, 2, 1),
      }),
    ),
    contact: base(
      'contact',
      z.object({
        ...heading,
        layout: f(z.enum(['split', 'cards', 'centered']), 'split'),
        showPhone: bool(true),
        showWhatsapp: bool(true),
        showEmail: bool(true),
        showAddress: bool(true),
        showHours: bool(true),
        showSocial: bool(true),
        showMap: bool(false),
        showActions: bool(true),
      }),
    ),
    social: base(
      'social',
      z.object({
        ...heading,
        display: f(z.enum(['icons', 'buttons', 'cards']), 'buttons'),
        alignment: f(z.enum(['left', 'center']), 'center'),
      }),
    ),
    spacer: base(
      'spacer',
      z.object({
        height: f(z.enum(['xs', 'sm', 'md', 'lg', 'xl']), 'md'),
        divider: f(z.enum(['none', 'line', 'dots', 'ornament']), 'none'),
      }),
    ),
    image: base(
      'image',
      z.object({
        ...heading,
        image: image,
        alt: text(200),
        caption: text(200),
        ratio: f(z.enum(['original', 'landscape', 'wide', 'square', 'portrait']), 'original'),
        rounded: bool(true),
        link,
      }),
    ),
    video: base(
      'video',
      z.object({
        ...heading,
        /** YouTube, Vimeo o enlace directo .mp4/.webm (https). */
        url: f(z.union([z.literal(''), z.url({ protocol: /^https$/ }).max(500)]), ''),
        ratio: f(z.enum(['16:9', '4:3', '1:1', '9:16']), '16:9'),
        autoplay: bool(false),
        layout: f(z.enum(['full', 'split']), 'full'),
        body: text(2000),
      }),
    ),
    faq: base(
      'faq',
      z.object({
        ...heading,
        items: f(z.array(z.object({ id: z.string().max(64), question: text(200), answer: text(2000) })).max(40), []),
        layout: f(z.enum(['accordion', 'list', 'twoColumns']), 'accordion'),
        openFirst: bool(true),
      }),
    ),
    pricing: base(
      'pricing',
      z.object({
        ...heading,
        plans: f(
          z
            .array(
              z.object({
                id: z.string().max(64),
                name: text(60),
                price: text(40),
                period: text(30),
                description: text(200),
                features: f(z.array(z.string().max(120)).max(15), []),
                highlighted: bool(false),
                badge: text(30),
                button,
              }),
            )
            .max(6),
          [],
        ),
        columns: columns(3, 2, 1),
      }),
    ),
    team: base(
      'team',
      z.object({
        ...heading,
        members: f(z.array(z.object({ id: z.string().max(64), name: text(80), role: text(80), bio: text(400), photo: f(z.string().max(1000).nullable(), null) })).max(24), []),
        layout: f(z.enum(['grid', 'list']), 'grid'),
        photoShape: f(z.enum(['circle', 'rounded', 'square']), 'circle'),
        columns: columns(4, 3, 2),
      }),
    ),
    stats: base(
      'stats',
      z.object({
        ...heading,
        items: f(z.array(z.object({ id: z.string().max(64), value: text(24), label: text(80), icon: f(z.union([z.literal(''), z.enum(ICON_IDS)]), '') })).max(8), []),
        layout: f(z.enum(['inline', 'cards']), 'inline'),
        alignment: f(z.enum(['left', 'center']), 'center'),
      }),
    ),
    logos: base(
      'logos',
      z.object({
        ...heading,
        logos: f(z.array(z.object({ path: z.string().max(1000), name: text(80), url: f(z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(500)]), '') })).max(30), []),
        grayscale: bool(true),
        size: f(z.enum(['sm', 'md', 'lg']), 'md'),
        columns: columns(5, 4, 2),
      }),
    ),
    /** Pedido rápido: todos los productos en lista compacta con su cantidad (para pedir muchos de una vez). */
    quickorder: base(
      'quickorder',
      z.object({
        ...heading,
        /** Todos los productos o los de una categoría. */
        categoryId: f(z.union([z.literal(''), z.uuid()]), ''),
        groupByCategory: bool(true),
        showImages: bool(true),
      }),
    ),
    /**
     * Tabla (comparativas, horarios, tallas, precios por volumen…). Las celdas de
     * cada fila van en el orden de las columnas; en celular se desliza o se
     * vuelve tarjetas.
     */
    table: base(
      'table',
      z.object({
        ...heading,
        columns: f(
          z.array(z.object({ id: z.string().max(64), label: text(80), align: f(z.enum(['left', 'center', 'right']), 'left') })).min(1).max(TABLE_MAX_COLUMNS),
          [
            { id: 'c1', label: 'Servicio', align: 'left' },
            { id: 'c2', label: 'Básico', align: 'center' },
            { id: 'c3', label: 'Completo', align: 'center' },
          ],
        ),
        rows: f(
          z.array(z.object({ id: z.string().max(64), cells: f(z.array(text(300)).max(TABLE_MAX_COLUMNS), []) })).max(TABLE_MAX_ROWS),
          [
            { id: 'r1', cells: ['Precio', '$299', '$499'] },
            { id: 'r2', cells: ['Duración', '1 hora', '2 horas'] },
            { id: 'r3', cells: ['Incluye materiales', '—', '✓'] },
          ],
        ),
        /** La primera columna nombra cada fila (en negritas y fija al deslizar en celular). */
        rowHeaders: bool(true),
        variant: f(z.enum(['simple', 'striped', 'bordered']), 'striped'),
        header: f(z.enum(['plain', 'accent', 'dark']), 'accent'),
        /** Columna resaltada (1 = la primera; 0 = ninguna), p. ej. el plan recomendado. */
        highlight: f(z.number().int().min(0).max(TABLE_MAX_COLUMNS), 0),
        compact: bool(false),
        /** En celular: deslizar la tabla o mostrar cada fila como tarjeta. */
        mobile: f(z.enum(['scroll', 'cards']), 'scroll'),
        /** Nota debajo de la tabla ("Precios en MXN, IVA incluido"). */
        note: text(200),
      }),
    ),
    /** HTML propio (se limpia al guardar y al mostrar). Sólo se muestra con código propio habilitado. */
    html: base(
      'html',
      z.object({
        html: text(MAX_HTML_LENGTH),
      }),
    ),
    /** Widget con código (scripts) en un iframe aislado. Sólo se muestra con código propio habilitado. */
    embed: base(
      'embed',
      z.object({
        /** Nombre accesible del iframe ("Reservas", "Mapa de sucursales"…). */
        title: text(80),
        code: text(MAX_EMBED_LENGTH),
        /** Alto en px; 0 = automático (el widget avisa su altura). */
        height: f(z.number().int().min(0).max(2000), 0),
        /** Pantalla completa: del alto de la ventana y con su propio scroll (páginas completas con menú fijo, modales…). */
        fullScreen: bool(false),
      }),
    ),
    columns: base(
      'columns',
      z.object({
        ...heading,
        layout: f(z.enum(COLUMN_LAYOUTS), '1-1'),
        gap: f(z.enum(['sm', 'md', 'lg']), 'md'),
        verticalAlign: f(z.enum(['top', 'center', 'bottom', 'stretch']), 'center'),
        /** En tablet: igual que en escritorio o en 2 columnas. */
        tablet: f(z.enum(['same', '2', '1']), '2'),
        /** En celular: una columna (apiladas) o dos. */
        mobile: f(z.enum(['1', '2']), '1'),
        reverseOnMobile: bool(false),
        columns: f(z.array(column).min(1).max(4), [
          { id: 'c1', blocks: [], align: 'left', surface: 'none', padding: 'none' },
          { id: 'c2', blocks: [], align: 'left', surface: 'none', padding: 'none' },
        ]),
      }),
    ),
  } satisfies Record<SectionType, z.ZodType>;

  const section = z.discriminatedUnion('type', [
    sections.hero,
    sections.text,
    sections.products,
    sections.services,
    sections.product,
    sections.catalog,
    sections.categories,
    sections.banner,
    sections.gallery,
    sections.features,
    sections.testimonials,
    sections.contact,
    sections.social,
    sections.spacer,
    sections.image,
    sections.video,
    sections.faq,
    sections.pricing,
    sections.team,
    sections.stats,
    sections.logos,
    sections.columns,
    sections.quickorder,
    sections.table,
    sections.html,
    sections.embed,
  ]);

  return { sections, section, style, link, button };
}

const strict = build(false);
const lenient = build(true);

export const sectionSchema = strict.section;
export const sectionSchemas = strict.sections;
export const sectionStyleSchema = strict.style;
export const linkTargetSchema = strict.link;
export const buttonSchema = strict.button;

export type Section = z.output<typeof sectionSchema>;
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;
export type SectionStyle = z.output<typeof sectionStyleSchema>;
export type LinkTarget = z.output<typeof linkTargetSchema>;
export type ButtonConfig = z.output<typeof buttonSchema>;
export type Columns = SectionOf<'categories'>['content']['columns'];

/** Lee secciones guardadas: descarta tipos desconocidos, corrige valores inválidos. */
export function parseSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const type = (entry as { type?: unknown })?.type;
    if (typeof type !== 'string' || !(SECTION_TYPES as readonly string[]).includes(type)) return [];
    const result = lenient.sections[type as SectionType].safeParse(migrateLegacySection(entry as Record<string, unknown>));
    return result.success ? [result.data as Section] : [];
  });
}

export function createSection<T extends SectionType>(
  type: T,
  content: Record<string, unknown> = {},
  style: Record<string, unknown> = {},
  id: string = crypto.randomUUID(),
): SectionOf<T> {
  // Acepta también las claves de la v2 (source, limit, layout…): se convierten a colección + presentación.
  return sectionSchemas[type].parse(migrateLegacySection({ id, type, content, style })) as SectionOf<T>;
}

/* ------------------------------------------------------------------ v2 → v3 */

type Obj = Record<string, unknown>;

const LEGACY_KEYS = ['layout', 'columns', 'source', 'limit', 'itemIds', 'categoryId', 'cardStyle', 'showImage', 'showPrice', 'showDescription', 'showSearch', 'showCategoryNav', 'showFilters'];

/**
 * Secciones de producto guardadas antes de la v3 (layout/columns/source
 * sueltos) → colección + presentación. Conserva las decisiones del usuario.
 */
function migrateLegacySection(entry: Obj): Obj {
  const content = (entry.content ?? {}) as Obj;
  const type = entry.type;
  if ((type !== 'products' && type !== 'services' && type !== 'catalog') || content.presentation || content.collection) return entry;
  if (!LEGACY_KEYS.some((key) => key in content)) return entry;
  const columns = (content.columns ?? {}) as Obj;
  const fields = {
    image: content.showImage,
    price: content.showPrice,
    description: content.showDescription,
  };
  let presentation: Obj;
  if (type === 'products') {
    presentation = {
      layout: content.layout === 'list' ? 'compactList' : 'grid',
      arrangement: content.layout === 'carousel' ? 'carousel' : 'grid',
      columns: { ...columns, pdf: 3 },
      cardStyle: content.cardStyle,
      fields,
    };
  } else if (type === 'services') {
    const layout = { compact: 'priceList', rows: 'compactList', cards: 'grid' }[String(content.layout)] ?? 'zigzag';
    presentation = { layout, columns: { ...columns, pdf: 2 }, cardStyle: content.cardStyle, fields };
  } else {
    presentation = {
      layout: content.layout === 'list' ? 'compactList' : content.layout === 'showcase' ? 'largeCards' : 'grid',
      columns: { ...columns, pdf: 3 },
      cardStyle: content.cardStyle,
    };
  }
  const next: Obj = { ...content, presentation };
  if (type !== 'catalog') {
    next.collection = { source: content.source, itemType: content.itemType, categoryId: content.categoryId, itemIds: content.itemIds, limit: content.source === 'manual' ? 0 : content.limit, sort: 'custom' };
  } else {
    next.filters = { search: content.showSearch, categories: content.showCategoryNav, types: content.showFilters, availability: content.showFilters };
  }
  return { ...entry, content: next };
}

/* ------------------------------------------------------------------ Columnas */

export type ColumnsContent = SectionOf<'columns'>['content'];
export type ColumnBlock = ColumnsContent['columns'][number]['blocks'][number];
export type ColumnBlockOf<K extends ColumnBlockKind> = Extract<ColumnBlock, { kind: K }>;

/** Bloque nuevo con sus valores por defecto (y los campos dados). */
export function createColumnBlock<K extends ColumnBlockKind>(kind: K, fields: Record<string, unknown> = {}): ColumnBlockOf<K> {
  const parsed = lenient.sections.columns.parse({ id: 'x', type: 'columns', content: { columns: [{ id: 'c', blocks: [{ id: crypto.randomUUID(), ...fields, kind }] }] } });
  return parsed.content.columns[0].blocks[0] as ColumnBlockOf<K>;
}
