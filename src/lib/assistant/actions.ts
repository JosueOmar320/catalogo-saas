import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/design/presets';
import { PAGE_BLUEPRINT_IDS } from '@/lib/site/blueprints';
import { SECTION_TYPES } from '@/lib/site/section-schemas';

/**
 * Catálogo de acciones de Garfield AI: la ÚNICA forma en que el asistente
 * puede cambiar algo. El modelo sólo propone estas acciones (este schema
 * genera la herramienta que recibe); el servidor y el editor las validan y
 * las ejecuta el mismo reducer que usan los botones del builder.
 *
 * Referencias (`ref`):
 * - página: id · slug · título · "current" (la abierta) · "$alias"
 * - sección: id · "selected" (la seleccionada) · "last" (la última tocada) ·
 *   "type:products" (primera de ese tipo en la página) · título · "$alias"
 */
const ref = z.string().trim().min(1).max(120);
const alias = z.string().regex(/^\$[a-zA-Z0-9_-]{1,30}$/, 'Usa $nombre').optional().describe('Nombre para referirse a lo creado en acciones siguientes ($inicio, $promo…).');
const obj = z.record(z.string(), z.unknown());

const position = z
  .object({
    after: ref.optional().describe('Colocar debajo de esta sección.'),
    before: ref.optional().describe('Colocar arriba de esta sección.'),
    place: z.enum(['start', 'end', 'up', 'down']).optional().describe('Al inicio, al final, o un lugar arriba/abajo (sólo mover).'),
  })
  .describe('Dónde colocar la sección. Por defecto: debajo de la sección seleccionada o al final.');

export const sectionSpecSchema = z.object({
  type: z.enum(SECTION_TYPES),
  content: obj.optional().describe('Campos de contenido del tipo (ver guía de secciones). Lo que falte toma su valor por defecto.'),
  style: obj.optional().describe('Estilo de la sección: background, textColor, paddingTop, paddingBottom, width, hideOnMobile, hideOnDesktop.'),
  name: z.string().max(60).optional().describe('Nombre interno opcional.'),
  as: alias,
});
export type SectionSpec = z.infer<typeof sectionSpecSchema>;

const navKinds = z.enum(['page', 'url', 'whatsapp', 'phone', 'email']);
/** Ruta de Storage de la biblioteca del negocio ("{negocio}/site/…"). Nunca URLs externas. */
const mediaPath = z.string().trim().min(3).max(300).regex(/^[0-9a-f-]{36}\/[a-z]+\/[^\s]+$/, 'Usa la ruta de la biblioteca (search_media / import_image)');

export const assistantActionSchema = z.discriminatedUnion('action', [
  /* ---------------- Páginas */
  z.object({
    action: z.literal('create_page'),
    title: z.string().trim().min(1).max(80),
    slug: z.string().max(60).optional(),
    blueprint: z.enum(PAGE_BLUEPRINT_IDS).optional().describe('Estructura base. Si envías `sections`, se usan esas en su lugar.'),
    topic: z.string().max(80).optional().describe('Rubro o tema para los textos del blueprint ("limpieza de oficinas").'),
    sections: z.array(sectionSpecSchema).max(20).optional(),
    showInNav: z.boolean().optional(),
    published: z.boolean().optional(),
    seo: z.object({ title: z.string().max(70).optional(), description: z.string().max(160).optional() }).optional(),
    as: alias,
  }),
  z.object({
    action: z.literal('update_page'),
    page: ref,
    title: z.string().trim().min(1).max(80).optional(),
    slug: z.string().max(60).optional(),
    published: z.boolean().optional(),
    showInNav: z.boolean().optional(),
    seo: z.object({ title: z.string().max(70).optional(), description: z.string().max(160).optional(), noindex: z.boolean().optional() }).optional(),
  }),
  z.object({ action: z.literal('duplicate_page'), page: ref, title: z.string().max(80).optional(), as: alias }),
  z.object({ action: z.literal('delete_page'), page: ref }),
  z.object({ action: z.literal('set_home_page'), page: ref }),

  /* ---------------- Secciones */
  z.object({ action: z.literal('create_section'), page: ref.optional(), section: sectionSpecSchema, position: position.optional() }),
  z.object({
    action: z.literal('update_section'),
    section: ref,
    page: ref.optional(),
    content: obj.optional().describe('Sólo los campos a cambiar (merge profundo).'),
    style: obj.optional().describe('Sólo los campos de estilo a cambiar (merge profundo).'),
    name: z.string().max(60).optional(),
    visible: z.boolean().optional(),
  }),
  z.object({ action: z.literal('move_section'), section: ref, page: ref.optional(), position }),
  z.object({ action: z.literal('duplicate_section'), section: ref, page: ref.optional(), content: obj.optional().describe('Cambios para la copia.'), as: alias }),
  z.object({ action: z.literal('delete_section'), section: ref, page: ref.optional() }),

  /* ---------------- Productos */
  z.object({
    action: z.literal('update_product_display'),
    section: ref.describe('Sección de tipo products, services o catalog.'),
    page: ref.optional(),
    presentation: obj.optional().describe('Cambios de presentación: layout, columns {desktop,tablet,mobile,pdf}, gap, imageSize, ratio, shape, frame, imagePosition, separators, align, cardStyle, gallery, arrangement, fields {...}.'),
    collection: obj.optional().describe('Cambios de colección (products/services): source, itemType, categoryId, attributeId, attributeValue, itemIds, limit, sort.'),
    catalog: obj.optional().describe('Sólo catalog: itemType, groupByCategory, showFeatured, filters {...}, sort {default, allowUserSort}, pagination {mode, perPage}.'),
  }),

  /* ---------------- Diseño */
  z.object({
    action: z.literal('update_theme'),
    preset: z.enum(THEME_PRESETS.map((p) => p.id) as [string, ...string[]]).optional().describe('Aplica un tema completo (colores, tipografía, header, tarjetas…) antes de los demás cambios.'),
    colors: obj.optional(),
    typography: obj.optional(),
    spacing: obj.optional(),
    shape: obj.optional(),
    buttons: obj.optional(),
    header: obj.optional(),
    footer: obj.optional(),
    cards: obj.optional(),
    badges: obj.optional(),
  }),
  z.object({
    action: z.literal('update_background'),
    target: z.enum(['site', 'page', 'section', 'header', 'footer']),
    page: ref.optional(),
    section: ref.optional(),
    background: obj.describe('Fondo: { type: inherit|color|gradient|image|pattern, color, gradient {from,to,angle,kind}, pattern {id,color,opacity,scale}, overlay {color,opacity} }.'),
  }),

  /* ---------------- Navegación */
  z.object({
    action: z.literal('add_nav_item'),
    kind: navKinds,
    page: ref.optional().describe('Para kind=page.'),
    label: z.string().max(40).optional(),
    url: z.string().max(500).optional().describe('Para kind=url (https://…), phone o email.'),
    style: z.enum(['link', 'button']).optional(),
  }),
  z.object({
    action: z.literal('update_nav_item'),
    item: ref.describe('Id del ítem o "page:<ref de página>".'),
    label: z.string().max(40).optional(),
    visible: z.boolean().optional(),
    style: z.enum(['link', 'button']).optional(),
  }),
  z.object({ action: z.literal('remove_nav_item'), item: ref }),
  z.object({ action: z.literal('reorder_navigation'), order: z.array(ref).max(30).describe('Ids (o "page:<ref>") en el nuevo orden; los que falten quedan al final.') }),

  /* ---------------- Imágenes (rutas de la biblioteca del negocio: search_media / import_image / adjuntas) */
  z.object({
    action: z.literal('set_image'),
    section: ref,
    page: ref.optional(),
    path: mediaPath,
    target: z.enum(['auto', 'background', 'image']).optional().describe('auto: hero/banner → fondo con overlay; texto/imagen → imagen de la sección; galería → agrega.'),
    overlay: z.number().min(0).max(90).optional().describe('Oscurecer el fondo (0–90). Por defecto 45 en fondos con texto.'),
    alt: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal('add_gallery_images'),
    section: ref,
    page: ref.optional(),
    images: z.array(z.object({ path: mediaPath, caption: z.string().max(160).optional() })).min(1).max(40),
    replace: z.boolean().optional().describe('Reemplazar las imágenes actuales en lugar de agregar.'),
  }),
  z.object({ action: z.literal('reorder_gallery'), section: ref, page: ref.optional(), order: z.array(mediaPath).max(40) }),
  z.object({ action: z.literal('remove_gallery_images'), section: ref, page: ref.optional(), paths: z.array(mediaPath).min(1).max(40) }),

  /* ---------------- Catálogo (se guardan en la base al aplicar, con validación y permisos) */
  z.object({
    action: z.literal('create_category'),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500).optional(),
    imagePath: mediaPath.optional(),
    as: alias,
  }),
  z.object({
    action: z.literal('update_category'),
    category: ref.describe('Id o nombre de la categoría.'),
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(500).optional(),
    imagePath: mediaPath.nullable().optional(),
    active: z.boolean().optional(),
  }),
  z.object({ action: z.literal('delete_category'), category: ref }),
  z.object({ action: z.literal('reorder_categories'), order: z.array(ref).min(1).max(100) }),
  z.object({
    action: z.literal('create_product'),
    type: z.enum(['product', 'service']).optional(),
    name: z.string().trim().min(1).max(160),
    category: ref.optional().describe('Id, nombre o $alias de una categoría.'),
    price: z.number().min(0).max(99_999_999).nullable().optional(),
    compareAtPrice: z.number().min(0).max(99_999_999).nullable().optional().describe('Precio anterior (mayor que price) para mostrar oferta.'),
    priceNote: z.string().max(40).optional().describe('"desde", "por persona", "c/u"…'),
    shortDescription: z.string().max(300).optional(),
    description: z.string().max(5000).optional(),
    sku: z.string().max(64).optional(),
    featured: z.boolean().optional(),
    available: z.boolean().optional(),
    visible: z.boolean().optional(),
    badges: z.array(z.enum(['new', 'popular'])).max(2).optional().describe('"featured" se indica con featured; "oferta" con compareAtPrice.'),
    tags: z.array(z.string().max(30)).max(15).optional(),
    imagePaths: z.array(mediaPath).max(10).optional(),
    as: alias,
  }),
  z.object({
    action: z.literal('update_product'),
    product: ref.describe('Id o nombre del producto/servicio.'),
    name: z.string().trim().min(1).max(160).optional(),
    category: ref.nullable().optional(),
    price: z.number().min(0).max(99_999_999).nullable().optional(),
    compareAtPrice: z.number().min(0).max(99_999_999).nullable().optional(),
    priceNote: z.string().max(40).optional(),
    shortDescription: z.string().max(300).optional(),
    description: z.string().max(5000).optional(),
    sku: z.string().max(64).optional(),
    featured: z.boolean().optional(),
    available: z.boolean().optional(),
    visible: z.boolean().optional(),
    badges: z.array(z.enum(['new', 'popular'])).max(2).optional().describe('"featured" se indica con featured; "oferta" con compareAtPrice.'),
    tags: z.array(z.string().max(30)).max(15).optional(),
    imagePaths: z.array(mediaPath).max(10).optional().describe('Reemplaza la galería del producto (en orden).'),
  }),
  z.object({ action: z.literal('delete_product'), product: ref }),
  z.object({ action: z.literal('reorder_products'), order: z.array(ref).min(1).max(500) }),

  /* ---------------- Editor */
  z.object({ action: z.literal('focus'), page: ref.optional(), section: ref.optional() }).describe('Abre una página o sección en el editor, sin cambiarla.'),
]);

export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantActionType = AssistantAction['action'];

/** Respuesta del modelo: texto para el usuario + acciones + sugerencias de seguimiento. */
export const assistantResponseSchema = z.object({
  message: z.string().max(2000).describe('Respuesta breve y amable en español, en la voz de Garfield.'),
  actions: z.array(assistantActionSchema).max(40).describe('Acciones a ejecutar. Vacío si sólo conversas o necesitas preguntar algo.'),
  suggestions: z.array(z.string().max(60)).max(4).describe('Hasta 4 siguientes pasos cortos que el usuario podría pedir.'),
});
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

/** Acciones que siempre piden confirmación. */
export const CONFIRM_ACTIONS: ReadonlySet<AssistantActionType> = new Set(['delete_page', 'delete_section', 'remove_nav_item', 'set_home_page', 'delete_category', 'delete_product']);

/** Acciones sobre productos y categorías: se ejecutan en el servidor al aplicar (no en el borrador). */
export const CATALOG_ACTIONS: ReadonlySet<AssistantActionType> = new Set([
  'create_category',
  'update_category',
  'delete_category',
  'reorder_categories',
  'create_product',
  'update_product',
  'delete_product',
  'reorder_products',
]);
export type CatalogAction = Extract<AssistantAction, { action: 'create_category' | 'update_category' | 'delete_category' | 'reorder_categories' | 'create_product' | 'update_product' | 'delete_product' | 'reorder_products' }>;
export const isCatalogAction = (a: AssistantAction): a is CatalogAction => CATALOG_ACTIONS.has(a.action);

/**
 * Valida las acciones una por una: las inválidas se descartan (con su error)
 * en lugar de invalidar toda la respuesta.
 */
export function parseActions(raw: unknown): { actions: AssistantAction[]; errors: string[] } {
  const list = Array.isArray(raw) ? raw.slice(0, 40) : [];
  const actions: AssistantAction[] = [];
  const errors: string[] = [];
  list.forEach((entry, i) => {
    const result = assistantActionSchema.safeParse(entry);
    if (result.success) actions.push(result.data);
    else errors.push(`Acción ${i + 1} (${(entry as { action?: string })?.action ?? '?'}): ${result.error.issues[0]?.message ?? 'inválida'}`);
  });
  return { actions, errors };
}
