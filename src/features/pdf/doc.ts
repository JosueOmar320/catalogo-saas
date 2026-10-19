import { visibleAttributes, type ResolvedAttribute } from '@/lib/catalog/attributes';
import type { Presentation } from '@/lib/catalog/presentation';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import type { PdfSettings, PdfTemplateId } from '@/lib/pdf/settings';
import type { SiteViewModel } from '@/lib/site/view-model';
import type { PdfContext } from './primitives';
import { siteYesNo } from '@/site-renderer/site-i18n';

/**
 * "Skin" de cada plantilla: los detalles de estilo que no son opciones del
 * usuario (cómo se ve una tarjeta, un precio o un título de categoría).
 * La composición (portada, bloques, layouts) sí es configurable.
 */
export type PdfSkin = {
  card: 'bordered' | 'soft' | 'framed' | 'plain';
  price: 'text' | 'pill' | 'tag';
  heading: 'underline' | 'pill' | 'number' | 'spaced' | 'ornament' | 'bar' | 'band';
  upper: boolean;
  center: boolean;
};

export const PDF_SKINS: Record<PdfTemplateId, PdfSkin> = {
  commercial: { card: 'soft', price: 'pill', heading: 'band', upper: false, center: false },
  catalog: { card: 'bordered', price: 'text', heading: 'underline', upper: false, center: false },
  editorial: { card: 'plain', price: 'text', heading: 'number', upper: false, center: false },
  minimal: { card: 'plain', price: 'text', heading: 'spaced', upper: true, center: false },
  brochure: { card: 'plain', price: 'tag', heading: 'bar', upper: true, center: false },
  technical: { card: 'bordered', price: 'text', heading: 'bar', upper: false, center: false },
  menu: { card: 'plain', price: 'text', heading: 'ornament', upper: false, center: true },
  modern: { card: 'soft', price: 'pill', heading: 'pill', upper: false, center: false },
  luxury: { card: 'framed', price: 'text', heading: 'ornament', upper: true, center: true },
  corporate: { card: 'bordered', price: 'text', heading: 'bar', upper: true, center: false },
  productBrochure: { card: 'plain', price: 'tag', heading: 'spaced', upper: false, center: false },
};

/** Todo lo que un bloque necesita para dibujarse. */
export type PdfDoc = PdfContext & {
  site: SiteViewModel;
  settings: PdfSettings;
  skin: PdfSkin;
  categoryNames: Map<string, string>;
  items: CatalogItemView[];
  /** Página en la que cae cada ancla (se llena durante el render). */
  marks: Map<string, number>;
  /** Números de página de la pasada anterior (para el índice). */
  toc: Map<string, number>;
  /** Título de cada bloque/categoría (para el encabezado "título de sección"). */
  sectionTitles: Map<string, string>;
};

/** Título de la sección que está en la página `n` (según la pasada anterior). */
export function sectionTitleAt(doc: PdfDoc, n: number): string {
  let best: { page: number; id: string } | null = null;
  for (const [id, page] of doc.toc) {
    if (page <= n && doc.sectionTitles.has(id) && (!best || page >= best.page)) best = { page, id };
  }
  return best ? (doc.sectionTitles.get(best.id) ?? '') : '';
}

/** Atributos a mostrar en el PDF según la presentación. */
export function pdfAttributes(doc: PdfDoc, item: CatalogItemView, mode: Presentation['fields']['attributes']): ResolvedAttribute[] {
  if (mode === 'none') return [];
  const defs = mode === 'card' ? doc.site.attributeDefs.filter((d) => d.showInCard) : doc.site.attributeDefs;
  return visibleAttributes(item.attributes, defs, 'pdf', siteYesNo(doc.site.settings.language));
}

/** Campos visibles: la presentación decide dentro de lo que permite el tema. */
export function pdfFields(doc: PdfDoc, p: Presentation) {
  const cards = doc.site.theme.cards;
  return {
    ...p.fields,
    price: p.fields.price && cards.showPrice,
    availability: p.fields.availability && cards.showAvailability,
    description: p.fields.description,
  };
}
