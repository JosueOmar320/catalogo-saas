import { z } from 'zod';
import { buildBackgroundSchema } from '@/lib/design/background';
import { ICON_IDS } from '@/lib/design/icons';
import { fieldFactory, hexColor } from '@/lib/design/schema-utils';
import { collectionSchema, lenientCollectionSchema, SORT_OPTIONS } from '@/lib/catalog/collections';
import { lenientPresentationSchema, presentationSchema } from '@/lib/catalog/presentation';

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
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  const bool = (v: boolean) => f(z.boolean(), v);
  const text = (max: number, v = '') => f(z.string().max(max), v);
  const uuidOrEmpty = f(z.union([z.literal(''), z.uuid()]), '');
  const image = z.object({ path: f(z.string().max(300).nullable(), null) }).prefault({});
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
      paddingTop: f(z.enum(['default', 'none', 'sm', 'md', 'lg', 'xl']), 'default'),
      paddingBottom: f(z.enum(['default', 'none', 'sm', 'md', 'lg', 'xl']), 'default'),
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
      hideOnMobile: bool(false),
      hideOnDesktop: bool(false),
      anchor: f(z.string().regex(/^[a-z0-9-]*$/).max(40), ''),
    })
    .prefault({});

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
        images: f(z.array(z.object({ path: z.string().max(300), caption: text(160) })).max(40), []),
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
                photo: f(z.string().max(300).nullable(), null),
                rating: f(z.number().int().min(0).max(5), 5),
              }),
            )
            .max(24),
          [],
        ),
        layout: f(z.enum(['grid', 'slider', 'single']), 'grid'),
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
        members: f(z.array(z.object({ id: z.string().max(64), name: text(80), role: text(80), bio: text(400), photo: f(z.string().max(300).nullable(), null) })).max(24), []),
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
        logos: f(z.array(z.object({ path: z.string().max(300), name: text(80), url: f(z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(500)]), '') })).max(30), []),
        grayscale: bool(true),
        size: f(z.enum(['sm', 'md', 'lg']), 'md'),
        columns: columns(5, 4, 2),
      }),
    ),
  } satisfies Record<SectionType, z.ZodType>;

  const section = z.discriminatedUnion('type', [
    sections.hero,
    sections.text,
    sections.products,
    sections.services,
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
