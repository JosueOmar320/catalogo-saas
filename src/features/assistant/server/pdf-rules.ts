import type { AssistantContext } from '@/lib/assistant/context';
import type { ProductLayout } from '@/lib/catalog/presentation';
import type { PdfTemplateId } from '@/lib/pdf/settings';
import { foldText } from '@/lib/utils/text';

/**
 * Intérprete local del MODO PDF (sin IA): pedidos directos del estudio de
 * PDF → acciones de PDF. Mismo contrato que `rulesRespond` del sitio.
 */

type Out = { message: string; actions: Record<string, unknown>[]; suggestions: string[] };

const norm = (value: string) =>
  foldText(value)
    .replace(/[¿?¡!.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));
const NUMBER_WORDS: Record<string, string> = { dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', ocho: '8', nueve: '9', diez: '10', doce: '12' };
const withDigits = (text: string) => text.replace(/\b(dos|tres|cuatro|cinco|seis|ocho|nueve|diez|doce)\b/g, (w) => NUMBER_WORDS[w]);

const TEMPLATE_WORDS: [string[], PdfTemplateId][] = [
  [['lujo', 'lujoso', 'luxury', 'premium', 'elegante y exclusivo'], 'luxury'],
  [['corporativ', 'empresarial', 'institucional'], 'corporate'],
  [['folleto de producto', 'brochure de producto'], 'productBrochure'],
  [['folleto', 'brochure', 'servicios'], 'brochure'],
  [['menu', 'carta', 'lista de precios'], 'menu'],
  [['ficha tecnica', 'tecnico', 'especificaciones'], 'technical'],
  [['revista', 'editorial'], 'editorial'],
  [['minimal', 'minimalista', 'limpio', 'sencillo'], 'minimal'],
  [['moderno', 'moderna', 'actual'], 'modern'],
  [['comercial', 'promocional', 'ofertas'], 'commercial'],
  [['clasico', 'tradicional'], 'catalog'],
];

const LAYOUT_WORDS: [string[], ProductLayout][] = [
  [['lista de precios', 'menu con precios'], 'priceList'],
  [['comparacion', 'comparativa', 'tabla'], 'comparison'],
  [['zigzag', 'alternad'], 'zigzag'],
  [['ficha', 'detalle'], 'detail'],
  [['tarjetas grandes', 'grandes'], 'largeCards'],
  [['revista'], 'magazine'],
  [['minimalista', 'minimal'], 'minimal'],
  [['compacta', 'muchos por pagina'], 'compactGrid'],
  [['lista'], 'compactList'],
  [['cuadricula', 'grilla', 'grid', 'tarjetas'], 'grid'],
];

const COLORS: [string[], string][] = [
  [['dorado', 'oro'], '#B08D57'],
  [['negro'], '#111111'],
  [['azul marino', 'marino'], '#1B2A4A'],
  [['azul'], '#2F54D6'],
  [['rojo'], '#C8322B'],
  [['verde'], '#2E7D4F'],
  [['rosa'], '#E85D8F'],
  [['morado', 'violeta'], '#6D4AFF'],
  [['naranja'], '#F28C28'],
  [['crema', 'beige', 'marfil'], '#F6F0E6'],
  [['blanco'], '#FFFFFF'],
  [['gris'], '#F1F1F3'],
];
const findColor = (text: string) => COLORS.find(([words]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(text)))?.[1];

function mediaQueryFrom(text: string): string | undefined {
  const match = text.match(/(?:fotos?|imagen(?:es)?)\s+(?:de|con|del)\s+(?:la |el |los |las |un |una |mi |mis )?(.+?)(?=\s+(?:y|para|en|como|al)\b|$)/);
  return match?.[1] && match[1].length > 1 ? match[1].slice(0, 60) : undefined;
}

export function pdfRulesRespond(raw: string, ctx: AssistantContext): Out {
  const text = withDigits(norm(raw));
  const done = (message: string, actions: Record<string, unknown>[], suggestions: string[] = []): Out => ({ message, actions, suggestions });
  const blocks = ctx.pdf?.blocks ?? [];
  const selected = ctx.pdf?.selectedBlockId ?? null;
  const hasBlock = (type: string) => blocks.some((b) => b.type === type);

  if (!text || /^(hola|buenas|hey|ayuda|que puedes hacer)/.test(text)) {
    return done('¡Miau! Estoy en el estudio de PDF. Puedo cambiar la plantilla, la portada, el encabezado y el pie, cuántos productos van por página, y agregar páginas (índice, promoción, galería, contraportada).', [], ['Que parezca un catálogo de lujo', 'Cuatro productos por página', 'Agrega el logo arriba a la izquierda y el número de página abajo']);
  }

  /* ---------------- Plantilla / "que parezca…" */
  const template = TEMPLATE_WORDS.find(([words]) => has(text, ...words));
  if (template && has(text, 'parezca', 'estilo', 'plantilla', 'look', 'se vea', 'convierte', 'hazlo', 'tipo')) {
    const actions: Record<string, unknown>[] = [{ action: 'set_pdf_template', template: template[1] }];
    if (template[1] === 'luxury') actions.push({ action: 'update_pdf_cover', layout: 'framed', align: 'center', titleSize: 'lg', decoration: 'none' });
    return done(`Preparé el estilo «${template[1] === 'luxury' ? 'lujo' : template[1]}»: tipografía, portada, encabezado, pie y presentación de productos. Tu contenido se mantiene. Confírmalo para aplicarlo.`, actions, ['Usa un color de acento dorado', 'Dos productos por página']);
  }

  /* ---------------- Portada */
  if (has(text, 'portada') && !has(text, 'categoria')) {
    if (has(text, 'elegante', 'sofisticad', 'lujo')) {
      return done('Hice la portada más elegante: marco, texto centrado y tipografía con serifa.', [
        { action: 'update_pdf_cover', layout: 'framed', align: 'center', titleSize: 'lg', decoration: 'none' },
        { action: 'update_pdf_style', headingFont: 'playfair', uppercaseHeadings: 'yes' },
      ], ['Agrega una contraportada', 'Usa un color de acento dorado']);
    }
    if (has(text, 'moderna', 'moderno', 'llamativa')) return done('Portada más moderna: banda de color y formas.', [{ action: 'update_pdf_cover', layout: 'band', align: 'left', titleSize: 'xl', decoration: 'dots' }]);
    if (has(text, 'minimal', 'simple', 'limpia')) return done('Portada minimalista: sólo texto, centrado.', [{ action: 'update_pdf_cover', layout: 'minimal', align: 'center', decoration: 'none' }]);
    if (has(text, 'foto', 'imagen')) {
      const query = mediaQueryFrom(text);
      return done(query ? `Busqué una imagen de «${query}» para la portada.` : 'Puse una imagen de tu biblioteca en la portada.', [{ action: 'update_pdf_cover', layout: has(text, 'completa', 'sangre') ? 'fullImage' : 'imageTop', media: query ? { query } : { folder: 'banners' } }]);
    }
    const title = raw.match(/t[ií]tulo (?:de la portada )?(?:a|por|que diga) ["“']?(.+?)["”']?$/i)?.[1];
    if (title) return done('Cambié el título de la portada.', [{ action: 'update_pdf_cover', title: title.slice(0, 120) }]);
  }

  /* ---------------- Productos por página, columnas, layout */
  const perPage = text.match(/(\d{1,2})\s*(?:productos|items|servicios|platos|articulos)?\s*por\s*(?:pagina|hoja)/);
  const columns = text.match(/(\d)\s*columnas/);
  const layout = LAYOUT_WORDS.find(([words]) => has(text, ...words));
  if (perPage || columns || (layout && has(text, 'layout', 'formato', 'muestra', 'productos', 'como', 'usa', 'cambia', 'pon'))) {
    const action: Record<string, unknown> = { action: 'set_pdf_products_layout', block: selected && blocks.find((b) => b.id === selected && (b.type === 'catalog' || b.type === 'products')) && /\b(este|esta)\b/.test(text) ? 'selected' : 'all-products' };
    if (perPage) action.itemsPerPage = Math.min(60, Number(perPage[1]));
    if (columns) action.columns = Math.min(5, Math.max(1, Number(columns[1])));
    if (layout) action.layout = layout[1];
    if (perPage && !columns && !layout) {
      // 4 por página → 2 columnas; 6 → 3; 2 → 1 (fichas grandes).
      const n = Number(perPage[1]);
      action.columns = n <= 2 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
    }
    const parts = [perPage && `${perPage[1]} por página`, columns && `${columns[1]} columnas`, layout && `formato ${layout[1]}`].filter(Boolean).join(', ');
    return done(`Ajusté los productos del PDF: ${parts}.`, [action], ['Agrega una portada antes de cada categoría', 'Muestra el código de cada producto']);
  }

  /* ---------------- Categorías */
  if (has(text, 'categoria')) {
    if (has(text, 'portada', 'pagina de categoria', 'antes de cada', 'separador')) {
      return done('Cada categoría empieza ahora con su propia página de portada.', [{ action: 'set_pdf_products_layout', block: 'type:catalog', categoryStyle: 'hero', categoryNewPage: true }], ['Usa capítulos numerados en lugar de portadas']);
    }
    if (has(text, 'pagina nueva', 'nueva pagina', 'cada categoria en')) return done('Cada categoría empieza en una página nueva.', [{ action: 'set_pdf_products_layout', block: 'type:catalog', categoryNewPage: true }]);
    if (has(text, 'capitulo', 'numerad')) return done('Las categorías ahora son capítulos numerados.', [{ action: 'set_pdf_products_layout', block: 'type:catalog', categoryStyle: 'editorial' }]);
  }

  /* ---------------- Encabezado y pie */
  const actions: Record<string, unknown>[] = [];
  const notes: string[] = [];
  if (/\blogo\b/.test(text)) {
    const align = has(text, 'derecha') ? 'right' : has(text, 'centro', 'centrado') ? 'center' : 'left';
    if (has(text, 'quita', 'sin logo', 'oculta')) {
      actions.push({ action: 'update_pdf_header', showLogo: false });
      notes.push('sin logo en el encabezado');
    } else {
      actions.push({ action: 'update_pdf_header', showLogo: true, align, style: 'line' });
      notes.push(`logo arriba ${align === 'left' ? 'a la izquierda' : align === 'right' ? 'a la derecha' : 'al centro'}`);
    }
  }
  if (has(text, 'numero de pagina', 'numeros de pagina', 'numeracion', 'paginacion')) {
    if (has(text, 'quita', 'sin numer')) actions.push({ action: 'update_pdf_footer', pageNumbers: 'none' });
    else actions.push({ action: 'update_pdf_footer', pageNumbers: has(text, ' de ', 'total') ? 'ofTotal' : 'simple', style: 'line' });
    notes.push('números de página en el pie');
  }
  if (has(text, 'encabezado', 'header') && !/\blogo\b/.test(text)) {
    if (has(text, 'quita', 'sin encabezado', 'elimina')) actions.push({ action: 'update_pdf_header', style: 'none' });
    else actions.push({ action: 'update_pdf_header', style: has(text, 'banda', 'color') ? 'band' : 'line', showName: true });
    notes.push('encabezado en cada página');
  }
  if (has(text, 'pie de pagina', 'pie')) {
    if (has(text, 'nombre')) actions.push({ action: 'update_pdf_footer', showBusinessName: true });
    if (has(text, 'web', 'sitio')) actions.push({ action: 'update_pdf_footer', showWebsite: true });
    if (has(text, 'whatsapp')) actions.push({ action: 'update_pdf_footer', showWhatsapp: true });
    if (has(text, 'redes')) actions.push({ action: 'update_pdf_footer', showSocial: true });
    if (has(text, 'quita', 'sin pie')) actions.push({ action: 'update_pdf_footer', style: 'none' });
    if (actions.length) notes.push('pie de página');
  }
  if (actions.length) return done(`Listo: ${notes.join(', ')}.`, actions, ['Muestra el nombre del negocio en el pie']);

  /* ---------------- Páginas (bloques) */
  if (has(text, 'quita', 'elimina', 'borra', 'saca')) {
    const target = has(text, 'indice', 'contenido') ? 'type:toc' : has(text, 'contraportada') ? 'type:backCover' : has(text, 'contacto') ? 'type:contact' : has(text, 'galeria') ? 'type:gallery' : has(text, 'promo', 'oferta') ? 'type:promo' : /\b(este|esta)\b/.test(text) && selected ? 'selected' : null;
    if (target) return done('Listo para quitar esa página. Confírmalo abajo.', [{ action: 'remove_pdf_block', block: target }]);
  }
  if (has(text, 'agrega', 'anade', 'pon ', 'incluye', 'crea', 'quiero')) {
    if (has(text, 'indice', 'tabla de contenido')) {
      if (hasBlock('toc')) return done('Ya tienes un índice.', [{ action: 'focus_pdf_block', block: 'type:toc' }]);
      return done('Agregué un índice después de la portada.', [{ action: 'add_pdf_block', type: 'toc', position: hasBlock('cover') ? { after: 'type:cover' } : { place: 'start' } }]);
    }
    if (has(text, 'contraportada', 'ultima pagina', 'pagina final')) return done('Agregué una contraportada con tu logo y datos de contacto.', [{ action: 'add_pdf_block', type: 'backCover', position: { place: 'end' } }], ['Cambia el mensaje de la contraportada']);
    if (has(text, 'promocion', 'promocional', 'oferta')) {
      const badge = text.match(/(\d{1,2})\s*%/)?.[1];
      return done('Agregué una página promocional.', [{ action: 'add_pdf_block', type: 'promo', fields: { title: 'Oferta especial', ...(badge ? { badge: `-${badge}%` } : {}), collection: { source: 'sale', limit: 4 } }, position: { place: 'end' } }], ['Pon una foto en la promoción']);
    }
    if (has(text, 'galeria')) {
      const n = Number(text.match(/(\d{1,2})\s*(?:imagenes|fotos)/)?.[1] ?? 6);
      return done('Agregué una galería con imágenes de tu biblioteca.', [{ action: 'add_pdf_block', type: 'gallery', fields: { title: 'Galería' }, media: { latest: Math.min(40, n), ...(mediaQueryFrom(text) ? { query: mediaQueryFrom(text) } : {}) } }]);
    }
    if (has(text, 'pagina de imagen', 'foto a pagina completa', 'imagen grande', 'imagen a pagina')) {
      const query = mediaQueryFrom(text);
      return done('Agregué una página con una imagen grande.', [{ action: 'add_pdf_block', type: 'image', media: query ? { query } : {} }]);
    }
    if (has(text, 'contacto')) return done('Agregué la página de contacto.', [{ action: 'add_pdf_block', type: 'contact', position: { place: 'end' } }]);
    if (has(text, 'comparativa', 'comparacion')) return done('Agregué una tabla comparativa.', [{ action: 'add_pdf_block', type: 'comparison' }]);
    if (has(text, 'nosotros', 'informacion', 'pagina de texto', 'historia')) return done('Agregué una página de información.', [{ action: 'add_pdf_block', type: 'text', fields: { title: 'Sobre nosotros' } }]);
  }

  /* ---------------- Papel */
  if (has(text, 'horizontal', 'apaisad', 'vertical', 'tamano carta', 'carta', 'a4', 'a5', 'margenes', 'margen')) {
    const change: Record<string, unknown> = { action: 'update_pdf_settings' };
    if (has(text, 'horizontal', 'apaisad')) change.orientation = 'landscape';
    if (has(text, 'vertical')) change.orientation = 'portrait';
    if (/\bcarta\b/.test(text)) change.paperSize = 'LETTER';
    if (/\ba4\b/.test(text)) change.paperSize = 'A4';
    if (/\ba5\b/.test(text)) change.paperSize = 'A5';
    if (has(text, 'margen')) change.margins = has(text, 'pequen', 'chic', 'menos') ? 'small' : has(text, 'grande', 'mas') ? 'large' : 'medium';
    if (Object.keys(change).length > 1) return done('Cambié el formato del papel.', [change]);
  }

  /* ---------------- Estilo */
  if (has(text, 'tipografia', 'fuente', 'letra')) {
    const font = has(text, 'elegante', 'serif', 'clasica') ? 'playfair' : has(text, 'moderna', 'limpia') ? 'montserrat' : has(text, 'amigable', 'redonda') ? 'poppins' : null;
    if (font) return done('Cambié la tipografía de los títulos del PDF.', [{ action: 'update_pdf_style', headingFont: font }]);
  }
  if (has(text, 'color')) {
    const color = findColor(text);
    if (color) {
      if (has(text, 'fondo')) return done('Cambié el fondo de las páginas.', [{ action: 'update_pdf_settings', background: { type: 'color', color } }]);
      return done('Cambié el color de acento del PDF.', [{ action: 'update_pdf_style', accent: color, primary: color }]);
    }
  }
  if (has(text, 'fondo')) {
    const color = findColor(text);
    if (color) return done('Cambié el fondo de las páginas.', [{ action: 'update_pdf_settings', background: { type: 'color', color } }]);
  }
  if (has(text, 'compacto', 'mas apretado', 'menos espacio')) return done('Hice el PDF más compacto (más contenido por página).', [{ action: 'update_pdf_style', density: 'compact' }]);
  if (has(text, 'mas aire', 'mas espacio', 'aireado', 'respire')) return done('Le di más aire al PDF.', [{ action: 'update_pdf_style', density: 'airy' }]);
  if (has(text, 'letra mas grande', 'texto mas grande', 'mas grande la letra')) return done('Agrandé el texto del PDF.', [{ action: 'update_pdf_style', scale: 1.12 }]);
  if (has(text, 'letra mas chica', 'texto mas chico', 'letra mas pequena')) return done('Achiqué el texto del PDF.', [{ action: 'update_pdf_style', scale: 0.92 }]);
  if (has(text, 'ahorro de tinta', 'imprimir en casa', 'sin fondos')) return done('Activé el ahorro de tinta.', [{ action: 'update_pdf_settings', inkSaver: true }]);

  return done(
    'Mmm, esa no la entendí 😺. En el PDF entiendo pedidos como "cuatro productos por página", "logo arriba a la izquierda", "agrega una contraportada" o "que parezca un catálogo de lujo".',
    [],
    ['Que parezca un catálogo de lujo', 'Cuatro productos por página', 'Agrega una contraportada'],
  );
}
