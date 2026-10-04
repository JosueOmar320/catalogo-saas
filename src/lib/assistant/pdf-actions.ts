import { z } from 'zod';
import { PRODUCT_LAYOUTS } from '@/lib/catalog/presentation';
import { CATEGORY_STYLES, COVER_LAYOUTS, DECORATIONS, PDF_BLOCK_TYPES, PDF_DENSITIES, PDF_TEMPLATES } from '@/lib/pdf/settings';

/**
 * Acciones de Garfield en MODO PDF (estudio de PDF). Igual que en el sitio:
 * el modelo (o el intérprete local) sólo propone estas acciones; el
 * ejecutor puro (`features/assistant/pdf-executor.ts`) las aplica sobre el
 * borrador de la configuración, con vista previa y deshacer.
 *
 * Referencia de bloque (`block`): id · "selected" · "type:catalog" (primer
 * bloque de ese tipo) · "all-products" (todos los de catálogo/colección) ·
 * "#3" (posición, desde 1) · título · "$alias".
 */
const ref = z.string().trim().min(1).max(120);
const alias = z.string().regex(/^\$[a-zA-Z0-9_-]{1,30}$/, 'Usa $nombre').optional().describe('Nombre para referirse al bloque creado en acciones siguientes.');
const obj = z.record(z.string(), z.unknown());
const pdfImage = z.string().trim().min(3).max(1000).describe('Ruta de la biblioteca (search_media) o URL externa registrada.');
/** Imagen por descripción: el servidor la busca en la biblioteca y la reemplaza por una ruta real. */
export const mediaQuerySchema = z
  .object({
    query: z.string().trim().max(80).optional().describe('Qué buscar en la biblioteca ("comida", "fachada").'),
    folder: z.enum(['images', 'logos', 'products', 'backgrounds', 'banners', 'other']).optional(),
    latest: z.number().int().min(1).max(40).optional().describe('Las N más recientes (galerías).'),
  })
  .describe('Buscar la imagen en la biblioteca del negocio en lugar de dar la ruta.');

const position = z
  .object({ after: ref.optional(), before: ref.optional(), place: z.enum(['start', 'end', 'up', 'down']).optional() })
  .describe('Dónde colocar el bloque. Por defecto: al final (antes de la contraportada).');

export const pdfActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_pdf_template'), template: z.enum(PDF_TEMPLATES).describe('Aplica la plantilla (portada, encabezado, pie, tipografía y presentación) sin borrar contenido.') }),
  z.object({
    action: z.literal('update_pdf_settings'),
    paperSize: z.enum(['A4', 'LETTER', 'A5']).optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    margins: z.enum(['small', 'medium', 'large']).optional(),
    inkSaver: z.boolean().optional(),
    background: obj.optional().describe('Fondo de las páginas: { type: color|gradient|image|pattern, color, gradient {from,to,angle}, image {path,opacity}, pattern {id,color,opacity} }.'),
    decorations: z.object({ corners: z.enum(DECORATIONS).optional(), sparkles: z.boolean().optional(), frame: z.boolean().optional(), color: z.string().max(7).optional() }).optional(),
  }),
  z.object({
    action: z.literal('update_pdf_style'),
    headingFont: z.string().max(40).optional().describe('Id de fuente o "" para heredar del sitio.'),
    bodyFont: z.string().max(40).optional(),
    scale: z.number().min(0.8).max(1.3).optional().describe('Tamaño del texto respecto al sitio (1 = igual).'),
    density: z.enum(PDF_DENSITIES).optional(),
    primary: z.string().max(7).optional(),
    accent: z.string().max(7).optional(),
    heading: z.string().max(7).optional(),
    text: z.string().max(7).optional(),
    uppercaseHeadings: z.enum(['inherit', 'yes', 'no']).optional(),
  }),
  z.object({
    action: z.literal('update_pdf_cover'),
    layout: z.enum(COVER_LAYOUTS).optional(),
    eyebrow: z.string().max(80).optional(),
    title: z.string().max(120).optional(),
    subtitle: z.string().max(200).optional(),
    date: z.string().max(40).optional(),
    align: z.enum(['left', 'center']).optional(),
    titleSize: z.enum(['md', 'lg', 'xl']).optional(),
    showLogo: z.boolean().optional(),
    decoration: z.enum(DECORATIONS).optional(),
    imagePath: pdfImage.nullable().optional(),
    media: mediaQuerySchema.optional(),
    imageShape: z.enum(['rect', 'rounded', 'circle', 'arch']).optional(),
    background: obj.optional(),
  }),
  z.object({
    action: z.literal('update_pdf_header'),
    style: z.enum(['none', 'line', 'band', 'title']).optional(),
    showLogo: z.boolean().optional(),
    showName: z.boolean().optional(),
    showPageNumber: z.boolean().optional(),
    showSectionTitle: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional().describe('Posición del logo/nombre.'),
    text: z.string().max(80).optional(),
  }),
  z.object({
    action: z.literal('update_pdf_footer'),
    style: z.enum(['none', 'line', 'band']).optional(),
    pageNumbers: z.enum(['none', 'simple', 'ofTotal']).optional(),
    showBusinessName: z.boolean().optional(),
    showWebsite: z.boolean().optional(),
    showWhatsapp: z.boolean().optional(),
    showPhone: z.boolean().optional(),
    showEmail: z.boolean().optional(),
    showSocial: z.boolean().optional(),
    customText: z.string().max(160).optional(),
    align: z.enum(['spread', 'center']).optional(),
  }),
  z.object({
    action: z.literal('add_pdf_block'),
    type: z.enum(PDF_BLOCK_TYPES.filter((t) => t !== 'cover') as [string, ...string[]]),
    fields: obj.optional().describe('Campos del bloque (title, subtitle, body, imagePath, layout, presentation, collection, categoryStyle, itemsPerPage…).'),
    media: mediaQuerySchema.optional(),
    position: position.optional(),
    as: alias,
  }),
  z.object({ action: z.literal('update_pdf_block'), block: ref, fields: obj.describe('Cambios del bloque.'), media: mediaQuerySchema.optional() }),
  z.object({ action: z.literal('remove_pdf_block'), block: ref }),
  z.object({ action: z.literal('move_pdf_block'), block: ref, position }),
  z.object({ action: z.literal('duplicate_pdf_block'), block: ref, as: alias }),
  z.object({
    action: z.literal('set_pdf_products_layout'),
    block: ref.optional().describe('Por defecto: todos los bloques de productos ("all-products").'),
    layout: z.enum(PRODUCT_LAYOUTS).optional(),
    columns: z.number().int().min(1).max(5).optional().describe('Columnas en el PDF.'),
    itemsPerPage: z.number().int().min(0).max(60).optional().describe('Productos por página (0 = los que quepan).'),
    categoryStyle: z.enum(CATEGORY_STYLES).optional().describe('Cómo empieza cada categoría (hero = portada de categoría a página completa).'),
    categoryNewPage: z.boolean().optional(),
    fields: obj.optional().describe('Qué mostrar: image, description, price, sku, category, badges, attributes, compareAt, discount, availability.'),
    shape: z.enum(['rect', 'rounded', 'circle', 'arch']).optional(),
  }),
  z.object({ action: z.literal('focus_pdf_block'), block: ref }).describe('Selecciona un bloque en el estudio, sin cambiarlo.'),
]);

export type PdfAction = z.infer<typeof pdfActionSchema>;
export type PdfActionType = PdfAction['action'];
export const PDF_CONFIRM_ACTIONS: ReadonlySet<PdfActionType> = new Set(['remove_pdf_block', 'set_pdf_template']);

export function parsePdfActions(raw: unknown): { actions: PdfAction[]; errors: string[] } {
  const list = Array.isArray(raw) ? raw.slice(0, 40) : [];
  const actions: PdfAction[] = [];
  const errors: string[] = [];
  list.forEach((entry, i) => {
    const result = pdfActionSchema.safeParse(entry);
    if (result.success) actions.push(result.data);
    else errors.push(`Acción ${i + 1} (${(entry as { action?: string })?.action ?? '?'}): ${result.error.issues[0]?.message ?? 'inválida'}`);
  });
  return { actions, errors };
}
