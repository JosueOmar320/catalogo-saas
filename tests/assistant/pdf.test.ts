import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planPdfActions } from '@/features/assistant/pdf-executor';
import { interpretLocally } from '@/features/assistant/server/router';
import { buildAssistantContext } from '@/lib/assistant/context';
import { parsePdfActions } from '@/lib/assistant/pdf-actions';
import { buildPdfContext } from '@/lib/assistant/pdf-context';
import { defaultPdfSettings, pdfSettingsSchema, type PdfSettings } from '@/lib/pdf/settings';
import { buildSampleSite } from '@/lib/site/sample-site';

const site = buildSampleSite();

/** Pedido en el estudio de PDF → intérprete local → acciones válidas → plan sobre el borrador. */
function askPdf(text: string, settings: PdfSettings = defaultPdfSettings('catalog'), selectedBlockId: string | null = null) {
  const context = buildAssistantContext({
    site,
    pages: site.pages,
    theme: site.theme,
    navigation: site.navigation,
    panel: 'pages',
    currentPageId: site.pages[0].id,
    selectedSectionId: null,
    lastSectionIds: [],
    mode: 'pdf',
    pdf: buildPdfContext(settings, selectedBlockId),
  });
  const local = interpretLocally(text, context);
  const { actions, errors } = parsePdfActions(local.actions);
  assert.deepEqual(errors, [], `acciones inválidas para "${text}"`);
  const plan = planPdfActions(settings, actions, { selectedBlockId });
  for (const step of plan.steps) assert.equal(step.status, 'ok', `"${text}" → ${step.label}: ${step.error}`);
  assert.ok(pdfSettingsSchema.safeParse(plan.next).success, 'la configuración resultante es válida');
  return { local, actions, plan };
}

const catalogOf = (s: PdfSettings) => s.blocks.find((b) => b.type === 'catalog')!;

describe('Garfield en el estudio de PDF (modo local)', () => {
  it('"cuatro productos por página" → 4 por página en 2 columnas', () => {
    const { plan, local } = askPdf('Quiero cuatro productos por página');
    const catalog = catalogOf(plan.next);
    assert.equal(catalog.type === 'catalog' && catalog.itemsPerPage, 4);
    assert.equal(catalog.type === 'catalog' && catalog.presentation.columns.pdf, 2);
    assert.equal(local.unmatched.length, 0);
  });

  it('"usa un layout de dos columnas para los productos"', () => {
    const { plan } = askPdf('Usa un layout de dos columnas para los productos');
    const catalog = catalogOf(plan.next);
    assert.equal(catalog.type === 'catalog' && catalog.presentation.columns.pdf, 2);
  });

  it('"agrega una página de categoría antes de cada grupo de productos"', () => {
    const { plan } = askPdf('Agrega una página de categoría antes de cada grupo de productos');
    const catalog = catalogOf(plan.next);
    assert.equal(catalog.type === 'catalog' && catalog.categoryStyle, 'hero');
    assert.equal(catalog.type === 'catalog' && catalog.categoryNewPage, true);
  });

  it('logo arriba a la izquierda y número de página abajo (una sola frase)', () => {
    const { plan } = askPdf('Agrega el logo arriba a la izquierda y el número de página abajo.');
    assert.equal(plan.next.header.showLogo, true);
    assert.equal(plan.next.header.align, 'left');
    assert.notEqual(plan.next.header.style, 'none');
    assert.notEqual(plan.next.footer.pageNumbers, 'none');
  });

  it('"que parezca un catálogo de lujo" → plantilla lujo (pide confirmación) sin perder bloques', () => {
    const before = defaultPdfSettings('catalog');
    const { plan } = askPdf('Quiero que el PDF parezca un catálogo de lujo', before);
    assert.equal(plan.next.template, 'luxury');
    assert.equal(plan.next.cover.layout, 'framed');
    assert.equal(plan.needsConfirmation, true);
    assert.deepEqual(plan.next.blocks.map((b) => b.id), before.blocks.map((b) => b.id), 'la plantilla no borra contenido');
  });

  it('portada más elegante', () => {
    const { plan } = askPdf('Quiero que la portada sea más elegante');
    assert.equal(plan.next.cover.layout, 'framed');
    assert.equal(plan.next.style.headingFont, 'playfair');
  });

  it('contraportada al final e índice después de la portada', () => {
    const settings = { ...defaultPdfSettings('catalog') };
    settings.blocks = settings.blocks.filter((b) => b.type !== 'toc');
    const { plan } = askPdf('Agrega un índice. Luego agrega una contraportada', settings);
    const types = plan.next.blocks.map((b) => b.type);
    assert.equal(types[1], 'toc');
    assert.equal(types[types.length - 1], 'backCover');
  });

  it('el ejecutor rechaza imágenes que no están en la biblioteca', () => {
    const plan = planPdfActions(defaultPdfSettings(), [{ action: 'update_pdf_cover', imagePath: 'https://evil.example.com/x.jpg' }], { allowedMedia: [] });
    assert.equal(plan.steps[0].status, 'error');
    assert.equal(plan.changed, false);
  });

  it('un paso inválido no deja cambios a medias', () => {
    const plan = planPdfActions(defaultPdfSettings(), [{ action: 'remove_pdf_block', block: 'type:gallery' }, { action: 'update_pdf_header', showLogo: false }]);
    assert.equal(plan.steps[0].status, 'error');
    assert.equal(plan.steps[1].status, 'ok');
    assert.equal(plan.next.header.showLogo, false);
  });
});

describe('Router local: varias órdenes en un mensaje', () => {
  const siteContext = () =>
    buildAssistantContext({ site, pages: site.pages, theme: site.theme, navigation: site.navigation, panel: 'pages', currentPageId: site.pages[0].id, selectedSectionId: null, lastSectionIds: [] });

  it('divide en cláusulas y resuelve cada una', () => {
    const local = interpretLocally('Agrega una sección de preguntas frecuentes, luego cambia el color principal a verde y pon la sección de contacto al final', siteContext());
    const kinds = local.actions.map((a) => a.action);
    assert.ok(kinds.includes('create_section'));
    assert.ok(kinds.includes('update_theme'));
    assert.ok(kinds.includes('move_section'));
    assert.equal(local.unmatched.length, 0);
    assert.equal(local.creative, false);
  });

  it('"productos y servicios" no se parte (sólo antes de un verbo)', () => {
    const local = interpretLocally('Agrega una sección de productos y servicios destacados', siteContext());
    assert.equal(local.unmatched.length, 0);
    assert.equal(local.actions.filter((a) => a.action === 'create_section').length, 1);
  });

  it('pedidos creativos van al modelo de lenguaje', () => {
    const local = interpretLocally('Créame una página completa para una empresa de arquitectura con un estilo elegante y profesional', siteContext());
    assert.equal(local.creative, true);
  });

  it('imagen por descripción y galería con las últimas fotos (sin IA)', () => {
    const local = interpretLocally('Busca en mis imágenes una foto de comida y úsala en el hero', siteContext());
    assert.deepEqual(local.actions[0], { action: 'set_image', section: 'type:hero', media: { query: 'comida' } });
    const gallery = interpretLocally('Agrega una galería con las últimas 6 imágenes', siteContext());
    assert.equal(gallery.actions[0].action, 'create_section');
    assert.deepEqual(gallery.actions[1], { action: 'add_gallery_images', section: '$galeria', media: { latest: 6 } });
  });

  it('"cambia el layout a cuatro columnas" sobre la sección seleccionada', () => {
    const home = site.pages.find((p) => p.isHome)!;
    const products = home.sections.find((s) => s.type === 'products' || s.type === 'catalog')!;
    const context = { ...siteContext(), selectedSectionId: products.id };
    const local = interpretLocally('Cambia el layout a cuatro columnas', context);
    assert.equal(local.actions[0].action, 'update_product_display');
    assert.deepEqual((local.actions[0].presentation as { columns: unknown }).columns, { desktop: 4 });
  });
});
