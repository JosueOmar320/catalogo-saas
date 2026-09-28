import { z } from 'zod';
import { buildBackgroundSchema } from '@/lib/design/background';
import { ICON_IDS } from '@/lib/design/icons';
import { fieldFactory } from '@/lib/design/schema-utils';
import { CARD_STYLES } from '@/lib/design/styles-registry';

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

  const itemSource = {
    source: f(z.enum(['featured', 'latest', 'category', 'manual', 'all']), 'featured'),
    categoryId: uuidOrEmpty,
    itemIds: f(z.array(z.uuid()).max(100), []),
    limit: f(z.number().int().min(1).max(48), 8),
    showPrice: bool(true),
    showDescription: bool(true),
    showImage: bool(true),
    cardStyle: f(z.union([z.literal('inherit'), z.enum(CARD_STYLES)]), 'inherit'),
    button,
  };

  const style = z
    .object({
      background: buildBackgroundSchema(lenient).prefault({}),
      textColor: f(z.enum(['auto', 'light', 'dark']), 'auto'),
      paddingTop: f(z.enum(['default', 'none', 'sm', 'md', 'lg', 'xl']), 'default'),
      paddingBottom: f(z.enum(['default', 'none', 'sm', 'md', 'lg', 'xl']), 'default'),
      width: f(z.enum(['contained', 'wide', 'full']), 'contained'),
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
        ...itemSource,
        itemType: f(z.enum(['any', 'product', 'service']), 'product'),
        layout: f(z.enum(['grid', 'list', 'carousel']), 'grid'),
        columns: columns(4, 3, 2),
      }),
    ),
    services: base(
      'services',
      z.object({
        ...heading,
        ...itemSource,
        source: f(z.enum(['featured', 'latest', 'category', 'manual', 'all']), 'all'),
        itemType: f(z.enum(['any', 'product', 'service']), 'service'),
        layout: f(z.enum(['cards', 'rows', 'compact']), 'cards'),
        columns: columns(2, 2, 1),
      }),
    ),
    catalog: base(
      'catalog',
      z.object({
        ...heading,
        itemType: f(z.enum(['any', 'product', 'service']), 'any'),
        layout: f(z.enum(['grid', 'list', 'showcase']), 'grid'),
        columns: columns(3, 3, 2),
        cardStyle: f(z.union([z.literal('inherit'), z.enum(CARD_STYLES)]), 'inherit'),
        showSearch: bool(true),
        showFilters: bool(true),
        showCategoryNav: bool(true),
        groupByCategory: bool(true),
        showFeatured: bool(true),
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
export type Columns = SectionOf<'products'>['content']['columns'];

/** Lee secciones guardadas: descarta tipos desconocidos, corrige valores inválidos. */
export function parseSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const type = (entry as { type?: unknown })?.type;
    if (typeof type !== 'string' || !(SECTION_TYPES as readonly string[]).includes(type)) return [];
    const result = lenient.sections[type as SectionType].safeParse(entry);
    return result.success ? [result.data as Section] : [];
  });
}

export function createSection<T extends SectionType>(
  type: T,
  content: Record<string, unknown> = {},
  style: Record<string, unknown> = {},
  id: string = crypto.randomUUID(),
): SectionOf<T> {
  return sectionSchemas[type].parse({ id, type, content, style }) as SectionOf<T>;
}
