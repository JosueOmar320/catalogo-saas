import { z } from 'zod';
import { buildBackgroundSchema } from '@/lib/design/background';
import { fieldFactory, hexColor } from '@/lib/design/schema-utils';

/**
 * Configuración del PDF (catalogs.pdf). El PDF es otro destino de render del
 * mismo sitio: usa el tema (colores, fuentes, logo, fondo) y las páginas.
 */
export const PDF_TEMPLATES = ['classic', 'modern', 'editorial', 'minimal', 'luxury', 'menu'] as const;
export type PdfTemplateId = (typeof PDF_TEMPLATES)[number];

export const PDF_TEMPLATE_META: Record<PdfTemplateId, { label: string; description: string }> = {
  classic: { label: 'Catálogo clásico', description: 'Portada con foto, categorías subrayadas y cuadrícula de tarjetas.' },
  modern: { label: 'Catálogo moderno', description: 'Portada en bloque de color, etiquetas de categoría y precios destacados.' },
  editorial: { label: 'Editorial', description: 'Como una revista: portada dividida y productos en filas grandes alternadas.' },
  minimal: { label: 'Minimal', description: 'Mucho aire, líneas finas y lista con miniaturas.' },
  luxury: { label: 'Lujo', description: 'Fondo oscuro, marcos y ornamentos en el color de acento.' },
  menu: { label: 'Menú / Restaurante', description: 'Dos columnas de texto con puntos guía hasta el precio.' },
};

export const PDF_BLOCK_TYPES = ['cover', 'catalog', 'page', 'contact'] as const;

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  const bool = (v: boolean) => f(z.boolean(), v);
  const text = (max: number) => f(z.string().trim().max(max), '');
  return z.object({
    template: f(z.enum(PDF_TEMPLATES), 'classic'),
    paperSize: f(z.enum(['A4', 'LETTER', 'A5']), 'A4'),
    orientation: f(z.enum(['portrait', 'landscape']), 'portrait'),
    margins: f(z.enum(['small', 'medium', 'large', 'custom']), 'medium'),
    customMargin: f(z.number().min(5).max(40), 15),
    content: f(
      z
        .array(z.object({ id: z.string().max(64), type: z.enum(PDF_BLOCK_TYPES), pageId: f(z.string().max(64), ''), enabled: f(z.boolean(), true) }))
        .max(40),
      [
        { id: 'cover', type: 'cover', pageId: '', enabled: true },
        { id: 'catalog', type: 'catalog', pageId: '', enabled: true },
        { id: 'contact', type: 'contact', pageId: '', enabled: true },
      ],
    ),
    catalogFilter: f(z.enum(['all', 'products', 'services']), 'all'),
    cover: z
      .object({
        title: text(120),
        subtitle: text(200),
        showLogo: bool(true),
        showDescription: bool(true),
        showContact: bool(true),
        imageSource: f(z.enum(['cover', 'custom', 'none']), 'cover'),
        imagePath: f(z.string().max(300).nullable(), null),
        background: buildBackgroundSchema(lenient).prefault({}),
      })
      .prefault({}),
    header: z
      .object({
        enabled: bool(true),
        showLogo: bool(true),
        showName: bool(true),
        showPageNumber: bool(false),
        separator: bool(true),
        color: f(z.union([z.literal(''), hexColor]), ''),
        text: text(80),
      })
      .prefault({}),
    footer: z
      .object({
        enabled: bool(true),
        pageNumbers: f(z.enum(['none', 'simple', 'ofTotal']), 'ofTotal'),
        showPhone: bool(false),
        showWhatsapp: bool(true),
        showEmail: bool(false),
        showWebsite: bool(true),
        customText: text(160),
      })
      .prefault({}),
    background: buildBackgroundSchema(lenient).prefault({}),
    inkSaver: bool(false),
    products: z
      .object({
        columns: f(z.number().int().min(1).max(4), 3),
        imageSize: f(z.enum(['none', 'sm', 'md', 'lg']), 'md'),
        showDescription: bool(true),
        showPrice: bool(true),
        showSku: bool(false),
        showCategory: bool(false),
        showBadges: bool(true),
        pageBreakPerCategory: bool(false),
      })
      .prefault({}),
  });
}

export const pdfSettingsSchema = build(false);
const lenientPdfSettingsSchema = build(true);

export type PdfSettings = z.output<typeof pdfSettingsSchema>;
export type PdfSettingsInput = z.input<typeof pdfSettingsSchema>;
export type PdfContentBlock = PdfSettings['content'][number];

/**
 * Lee la configuración guardada. Si el catálogo aún no tiene `pdf` (v1),
 * convierte las opciones viejas de settings.pdf.
 */
export function parsePdfSettings(raw: unknown, legacy?: unknown): PdfSettings {
  const value = raw && typeof raw === 'object' && Object.keys(raw).length > 0 ? raw : null;
  if (value) return lenientPdfSettingsSchema.parse(value);
  const old = (legacy && typeof legacy === 'object' ? legacy : {}) as Record<string, unknown>;
  return lenientPdfSettingsSchema.parse({
    template: old.layout === 'list' ? 'minimal' : 'classic',
    paperSize: old.paperSize,
    content: [
      { id: 'cover', type: 'cover', enabled: old.includeCover !== false },
      { id: 'catalog', type: 'catalog', enabled: true },
      { id: 'contact', type: 'contact', enabled: true },
    ],
    products: {
      showPrice: old.showPrices,
      showDescription: old.showDescriptions,
      pageBreakPerCategory: old.pageBreakPerCategory,
    },
  });
}

/** Valores sugeridos por plantilla (se aplican al elegirla; el usuario puede cambiarlos). */
export const TEMPLATE_DEFAULTS: Record<PdfTemplateId, Partial<Pick<PdfSettings, 'products'>>> = {
  classic: { products: { columns: 3, imageSize: 'md' } as PdfSettings['products'] },
  modern: { products: { columns: 3, imageSize: 'md' } as PdfSettings['products'] },
  editorial: { products: { columns: 1, imageSize: 'lg' } as PdfSettings['products'] },
  minimal: { products: { columns: 1, imageSize: 'sm' } as PdfSettings['products'] },
  luxury: { products: { columns: 2, imageSize: 'md' } as PdfSettings['products'] },
  menu: { products: { columns: 2, imageSize: 'none' } as PdfSettings['products'] },
};
