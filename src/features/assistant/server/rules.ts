import type { AssistantContext } from '@/lib/assistant/context';
import type { PageBlueprintId } from '@/lib/site/blueprints';
import { columnPreset } from '@/lib/site/column-presets';
import { SITE_TEMPLATES, SITE_TEMPLATE_WORDS } from '@/lib/site/templates';
import type { SectionType } from '@/lib/site/section-schemas';
import { foldText } from '@/lib/utils/text';

/**
 * Modo básico de Garfield (sin modelo de IA): reconoce los pedidos más
 * comunes en español y los traduce a las MISMAS acciones que produciría el
 * modelo. Es un respaldo y una herramienta de desarrollo, no un parser
 * exhaustivo: ante la duda, pide que lo diga de otra forma.
 */

type Out = { message: string; actions: Record<string, unknown>[]; suggestions: string[] };

const norm = (value: string) =>
  foldText(value)
    .replace(/[¿?¡!.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

/** "cuatro columnas" → "4 columnas" ("una/uno" no: son artículos en casi todos los pedidos). */
const NUMBER_WORDS: Record<string, string> = { dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10', doce: '12' };
const withDigits = (text: string) => text.replace(/\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\b/g, (w) => NUMBER_WORDS[w]);

/** Secciones (no de productos) cuyas columnas se pueden cambiar. */
const COLUMN_SECTIONS = new Set(['features', 'gallery', 'team', 'pricing', 'logos']);

/** "una foto de comida para el hero" → "comida". */
function mediaQueryFrom(text: string): string | undefined {
  const match = text.match(/(?:fotos?|imagen(?:es)?|fotografias?)\s+(?:de|con|del|sobre)\s+(?:la |el |los |las |un |una |mi |mis |nuestra |nuestro )?(.+?)(?=\s+(?:y|para|en|como|al|a la|de fondo)\b|$)/);
  const query = match?.[1]?.replace(/\b(fondo|portada|hero|biblioteca|mis imagenes)\b/g, '').trim();
  return query && query.length > 1 ? query.slice(0, 60) : undefined;
}

const COLORS: [string[], string][] = [
  [['blanco'], '#FFFFFF'],
  [['claro', 'clarito', 'suave'], '#FAF8F5'],
  [['crema', 'beige', 'marfil'], '#F6F0E6'],
  [['gris'], '#F1F1F3'],
  [['negro'], '#111111'],
  [['oscuro'], '#16161A'],
  [['azul marino', 'marino'], '#1B2A4A'],
  [['azul'], '#2F54D6'],
  [['celeste'], '#E8F1FB'],
  [['rojo'], '#C8322B'],
  [['verde'], '#2E7D4F'],
  [['menta'], '#E6F4EE'],
  [['rosa', 'rosado'], '#E85D8F'],
  [['amarillo'], '#F2C230'],
  [['morado', 'violeta', 'lila'], '#6D4AFF'],
  [['naranja'], '#F28C28'],
  [['dorado'], '#C9A45C'],
  [['cafe', 'marron'], '#6B4226'],
];

const findColor = (text: string) => COLORS.find(([words]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(text)))?.[1];

const PRESET_WORDS: [string[], string][] = [
  [['moderna', 'moderno', 'actual'], 'modern'],
  [['elegante', 'sofisticad'], 'elegant'],
  [['minimal', 'minimalista', 'limpia', 'simple'], 'minimal'],
  [['lujo', 'lujosa', 'premium'], 'luxury'],
  [['oscura', 'oscuro', 'dark'], 'dark'],
  [['colorida', 'alegre', 'divertida'], 'colorful'],
  [['corporativ', 'profesional', 'seria'], 'corporate'],
  [['restaurante', 'rustica', 'calida'], 'restaurant'],
  [['moda', 'editorial'], 'fashion'],
  [['industrial'], 'industrial'],
];

const HEADER_WORDS: [string[], string][] = [
  [['elegante'], 'elegant'],
  [['moderno', 'moderna'], 'modern'],
  [['minimal', 'simple', 'limpio'], 'minimal'],
  [['oscuro', 'negro'], 'dark'],
  [['centrado'], 'centered'],
  [['transparente'], 'transparent'],
  [['clasico'], 'classic'],
];

const FONTS: [string, string][] = [
  ['playfair', 'playfair'],
  ['montserrat', 'montserrat'],
  ['poppins', 'poppins'],
  ['lora', 'lora'],
  ['roboto', 'roboto'],
  ['inter', 'inter'],
  ['serif', 'playfair'],
  ['elegante', 'playfair'],
  ['moderna', 'poppins'],
];

const PAGE_WORDS: [string[], PageBlueprintId, string][] = [
  [['inicio', 'home', 'principal', 'portada'], 'home', 'Inicio'],
  [['servicio'], 'services', 'Servicios'],
  [['menu', 'carta'], 'menu', 'Menú'],
  [['producto', 'tienda', 'catalogo'], 'products', 'Productos'],
  [['nosotros', 'quienes somos', 'about', 'historia'], 'about', 'Nosotros'],
  [['contacto'], 'contact', 'Contacto'],
  [['promocion', 'oferta', 'descuento'], 'promotions', 'Promociones'],
  [['galeria', 'portafolio', 'fotos'], 'gallery', 'Galería'],
];

type SectionIntent = { type: SectionType; content: Record<string, unknown>; style?: Record<string, unknown> };

const SECTION_WORDS: [string[], () => SectionIntent[]][] = [
  [['imagen y texto', 'imagen con texto', 'texto e imagen', 'texto con imagen', 'foto y texto', 'foto con texto'], () => [{ type: 'columns', content: columnPreset('imageText') }]],
  [['tres tarjetas', '3 tarjetas', 'tarjetas de servicios', 'tarjetas con iconos'], () => [{ type: 'columns', content: columnPreset('threeCards') }]],
  [['proceso', 'pasos', 'como trabajamos', 'como funciona'], () => [{ type: 'columns', content: { title: '¿Cómo trabajamos?', ...columnPreset('steps') } }]],
  [['lista de beneficios', 'beneficios con imagen', 'lista con iconos'], () => [{ type: 'columns', content: columnPreset('benefitsImage') }]],
  [['dos botones', '2 botones', 'varios botones'], () => [{ type: 'columns', content: columnPreset('ctaButtons') }]],
  [['columnas', 'composicion libre'], () => [{ type: 'columns', content: columnPreset('imageText') }]],
  [['preguntas frecuentes', 'faq', 'dudas frecuentes'], () => [{ type: 'faq', content: { title: 'Preguntas frecuentes', items: [{ question: '¿Hacen envíos?', answer: 'Sí, escríbenos y te cotizamos el envío a tu zona.' }, { question: '¿Qué formas de pago aceptan?', answer: 'Efectivo, transferencia y tarjeta.' }] } }]],
  [['planes', 'paquetes', 'membresia', 'tabla de precios'], () => [{ type: 'pricing', content: { title: 'Planes', plans: [{ name: 'Básico', price: '$199', period: '/mes', features: ['Beneficio 1', 'Beneficio 2'] }, { name: 'Pro', price: '$399', period: '/mes', features: ['Todo lo del Básico', 'Beneficio extra'], highlighted: true, badge: 'Más elegido' }] } }]],
  [['equipo', 'quienes somos'], () => [{ type: 'team', content: { title: 'Nuestro equipo' } }]],
  [['estadistica', 'cifras', 'numeros', 'logros'], () => [{ type: 'stats', content: { items: [{ value: '+10', label: 'años de experiencia' }, { value: '+500', label: 'clientes felices' }, { value: '24 h', label: 'tiempo de respuesta' }] } }]],
  [['logos', 'marcas aliadas', 'aliados', 'patrocinador', 'confian en nosotros'], () => [{ type: 'logos', content: { title: 'Confían en nosotros' } }]],
  [['video'], () => [{ type: 'video', content: { title: 'Conócenos en video' } }]],
  [['promocion', 'oferta', 'descuento'], () => [
    { type: 'banner', content: { title: 'Promociones de la semana', subtitle: 'Aprovecha antes de que se agoten.', layout: 'full', button: { label: 'Pedir por WhatsApp', link: { kind: 'whatsapp' } } }, style: { background: { type: 'gradient' }, textColor: 'light' } },
    { type: 'products', content: { title: 'En oferta', collection: { source: 'sale', itemType: 'any', limit: 8 } } },
  ]],
  [['destacad', 'mas vendid', 'favorit', 'populares'], () => [{ type: 'products', content: { title: 'Productos destacados', collection: { source: 'featured' } } }]],
  [['novedad', 'nuevos'], () => [{ type: 'products', content: { title: 'Novedades', collection: { source: 'new' } } }]],
  [['catalogo', 'todos los productos'], () => [{ type: 'catalog', content: { title: 'Catálogo' } }]],
  [['categoria'], () => [{ type: 'categories', content: { title: 'Categorías' } }]],
  [['servicio'], () => [{ type: 'services', content: { title: 'Servicios' } }]],
  [['producto'], () => [{ type: 'products', content: { title: 'Productos', collection: { source: 'all', limit: 8 } } }]],
  [['contacto', 'contactanos', 'ubicacion', 'mapa'], () => [{ type: 'contact', content: { title: 'Contáctanos' } }]],
  [['galeria', 'fotos', 'imagenes'], () => [{ type: 'gallery', content: { title: 'Galería' } }]],
  [['testimonio', 'opinion', 'resena', 'clientes dicen'], () => [{ type: 'testimonials', content: { title: 'Lo que dicen nuestros clientes', items: [{ name: 'Cliente', text: 'Excelente servicio, muy recomendable.', rating: 5 }] } }]],
  [['beneficio', 'ventaja', 'caracteristica', 'por que elegirnos'], () => [{ type: 'features', content: { title: '¿Por qué elegirnos?', items: [{ icon: 'badge-check', title: 'Calidad', text: 'Cuidamos cada detalle.' }, { icon: 'clock', title: 'Rapidez', text: 'Respondemos en minutos.' }, { icon: 'heart', title: 'Atención', text: 'Te acompañamos en todo.' }] } }]],
  [['newsletter', 'suscri', 'llamado a la accion', 'cta', 'banner'], () => [{ type: 'banner', content: { title: '¿Hablamos?', subtitle: 'Escríbenos y te respondemos en minutos.', button: { label: 'Escribir por WhatsApp', link: { kind: 'whatsapp' } } } }]],
  [['redes', 'instagram', 'facebook'], () => [{ type: 'social', content: { title: 'Síguenos' } }]],
  [['hero', 'portada', 'encabezado principal'], () => [{ type: 'hero', content: { height: 'md' } }]],
  [['separador', 'espacio'], () => [{ type: 'spacer', content: { divider: 'line' } }]],
  [['texto', 'parrafo', 'introduccion', 'sobre nosotros', 'historia'], () => [{ type: 'text', content: { title: 'Sobre nosotros', body: 'Cuéntales a tus clientes quiénes son y qué los hace diferentes.' } }]],
];

const LAYOUT_WORDS: [string[], string][] = [
  [['lista de precios', 'menu con precios', 'tarifario'], 'priceList'],
  [['zigzag', 'alternad'], 'zigzag'],
  [['tarjetas grandes'], 'largeCards'],
  [['revista'], 'magazine'],
  [['comparacion', 'comparativa', 'tabla comparativa', 'comparar'], 'comparison'],
  [['minimalista', 'minimal', 'sencillo', 'limpio'], 'minimal'],
  [['cuadricula compacta', 'compacta', 'muchos por fila', 'mas columnas'], 'compactGrid'],
  [['editorial'], 'editorial'],
  [['imagen protagonista', 'foto completa'], 'imageFocus'],
  [['ficha', 'detalle'], 'detail'],
  [['lista compacta', 'en lista', 'lista'], 'compactList'],
  [['cuadricula', 'grilla', 'grid', 'tarjetas'], 'grid'],
];

const PRODUCT_TYPES = ['products', 'services', 'catalog'];

export function rulesRespond(raw: string, ctx: AssistantContext): Out {
  const text = withDigits(norm(raw));
  const page = ctx.pages.find((p) => p.id === ctx.currentPageId) ?? ctx.pages[0];
  const selected = page?.sections.find((s) => s.id === ctx.selectedSectionId) ?? ctx.pages.flatMap((p) => p.sections).find((s) => s.id === ctx.selectedSectionId);
  const refersToThis = /\b(esta|este|esto|aqui|la seleccionada)\b/.test(text);
  const target = (selected && (refersToThis || !text.includes('pagina'))) ? 'selected' : null;
  const productSection = () =>
    selected && PRODUCT_TYPES.includes(selected.type) ? 'selected' : page?.sections.find((s) => PRODUCT_TYPES.includes(s.type)) ? `type:${page.sections.find((s) => PRODUCT_TYPES.includes(s.type))!.type}` : null;
  const typeFromWords = (fragment: string): string | null => {
    for (const [words, build] of SECTION_WORDS) if (has(fragment, ...words)) return `type:${build()[build().length - 1].type}`;
    return null;
  };
  const positionFrom = (): Record<string, unknown> | undefined => {
    if (has(text, 'al final', 'abajo del todo', 'hasta abajo')) return { place: 'end' };
    if (has(text, 'al inicio', 'al principio', 'arriba del todo', 'hasta arriba', 'primero')) return { place: 'start' };
    const rel = text.match(/(arriba|antes|encima|debajo|despues|abajo) de (?:la seccion de |la de |la |el )?(.+)$/);
    if (rel) {
      const ref = /\b(esta|este|esto)\b/.test(rel[2]) ? 'selected' : typeFromWords(rel[2]);
      if (ref) return ['arriba', 'antes', 'encima'].includes(rel[1]) ? { before: ref } : { after: ref };
    }
    return undefined;
  };
  const done = (message: string, actions: Record<string, unknown>[], suggestions: string[]): Out => ({ message, actions, suggestions });

  /* ---------------- Saludo / ayuda */
  if (!text || /^(hola|buenas|hey|ayuda|que puedes hacer)/.test(text)) {
    return done('¡Miau! Estoy listo. Puedo crear páginas, agregar o mover secciones, cambiar colores y tipografías, y ajustar cómo se ven tus productos.', [], ['Crea una página de servicios', 'Agrega una sección de contacto', 'Haz el sitio más moderno']);
  }

  /* ---------------- Imágenes adjuntas en el chat */
  const attached = [...raw.matchAll(/\[Imagen adjunta: ([^\s\]]+)/g)].map((m) => m[1]);
  if (attached.length) {
    const gallery = has(text, 'galeria', 'fotos');
    const section = has(text, 'hero', 'portada', 'principal') ? 'type:hero' : gallery ? (selected?.type === 'gallery' ? 'selected' : 'type:gallery') : selected ? 'selected' : 'type:hero';
    if (gallery) return done('Agregué las imágenes a la galería.', [{ action: 'add_gallery_images', section, images: attached.map((path) => ({ path })) }], []);
    return done(
      has(text, 'fondo') ? 'Puse la imagen como fondo.' : 'Listo, usé tu imagen.',
      [{ action: 'set_image', section, path: attached[0], ...(has(text, 'fondo') ? { target: 'background' } : {}) }],
      ['Oscurece un poco más el fondo', 'Cambia el título de esta sección'],
    );
  }
  /* ---------------- Logo */
  if (/\blogo\b/.test(text) && has(text, 'header', 'encabezado', 'menu', 'arriba', 'usa', 'pon', 'muestra', 'agrega')) {
    if (has(text, 'quita', 'oculta', 'sin logo')) return done('Oculté el logo del encabezado.', [{ action: 'update_theme', header: { showLogo: false } }], []);
    if (ctx.hasLogo) return done('Listo: el logo del negocio se muestra en el encabezado.', [{ action: 'update_theme', header: { showLogo: true } }], ['Centra el logo', 'Haz el encabezado fijo al hacer scroll']);
    return done('Busqué el logo en tu biblioteca (carpeta Logos) para usarlo como logo del negocio y mostrarlo en el encabezado.', [{ action: 'set_logo', media: { folder: 'logos' }, showInHeader: true }], ['Centra el logo']);
  }

  /* ---------------- Galería con las últimas N imágenes */
  const latest = text.match(/\b(?:ultimas|recientes|mas recientes)\s+(\d{1,2})\s+(?:imagenes|fotos)\b/) ?? text.match(/\b(\d{1,2})\s+(?:imagenes|fotos)\s+(?:mas\s+)?recientes\b/);
  if (latest && has(text, 'galeria', 'fotos', 'imagenes')) {
    const count = Math.min(40, Math.max(1, Number(latest[1])));
    const query = mediaQueryFrom(text.replace(latest[0], ''));
    const media = { latest: count, ...(query ? { query } : {}) };
    const existing = selected?.type === 'gallery' ? 'selected' : page?.sections.some((x) => x.type === 'gallery') && !has(text, 'agrega una galeria', 'crea una galeria', 'nueva galeria') ? 'type:gallery' : null;
    if (existing) return done(`Agregué ${count} imágenes de tu biblioteca a la galería.`, [{ action: 'add_gallery_images', section: existing, media, replace: has(text, 'reemplaza', 'cambia') }], ['Muéstrala como mosaico', 'Ponla al final']);
    return done(`Creé una galería con ${count} imágenes de tu biblioteca.`, [
      { action: 'create_section', section: { type: 'gallery', content: { title: 'Galería' }, as: '$galeria' }, ...(positionFrom() ? { position: positionFrom() } : {}) },
      { action: 'add_gallery_images', section: '$galeria', media },
    ], ['Muéstrala como mosaico', 'Cambia el título de la galería']);
  }

  /* ---------------- Imágenes de fondo en varias secciones */
  if (has(text, 'imagenes de fondo', 'fondos con imagen', 'fondos con fotos', 'fotos de fondo') || (has(text, 'imagen de fondo', 'foto de fondo') && has(text, 'secciones', 'todas', 'cada'))) {
    const candidates = (page?.sections ?? []).filter((x) => ['hero', 'banner', 'stats', 'testimonials', 'columns', 'text', 'features'].includes(x.type)).slice(0, 4);
    const query = mediaQueryFrom(text) ?? (page?.title && page.title.toLowerCase() !== 'inicio' ? page.title : ctx.business.name);
    if (candidates.length) {
      return done(
        `Puse imágenes de fondo (oscurecidas para que se lea el texto) en ${candidates.length} secciones de «${page!.title}».`,
        [...candidates.map((x) => ({ action: 'set_image', section: x.id, media: { query }, target: 'background', overlay: 55 })), { action: 'polish_page', page: 'current', intensity: 'balanced' }],
        ['Hazla más llamativa', 'Usa otra imagen en el hero'],
      );
    }
  }

  /* ---------------- Más diseño (dirección de arte) */
  if (has(text, 'llamativ', 'elaborad', 'mas diseno', 'con diseno', 'dale vida', 'mas vistos', 'mas visual', 'muy simple', 'muy sencill', 'aburrid', 'muy plana', 'mas atractiv', 'mas dinamic', 'mas profesional', 'mas impactante')) {
    const intensity = has(text, 'mucho', 'muy llamativ', 'impactante', 'atrevid', 'audaz') ? 'bold' : has(text, 'un poco', 'sutil', 'ligeramente') ? 'subtle' : has(text, 'llamativ', 'dinamic', 'vida') ? 'bold' : 'balanced';
    return done(
      'Le di más diseño a la página: fondos alternados, bandas con tu color de marca' + (intensity === 'bold' ? ', degradados, divisores con ondas y parallax' : '') + '. Tus textos no cambiaron.',
      [{ action: 'polish_page', page: 'current', intensity }],
      ['Pon imágenes de fondo en las secciones', 'Agrega una sección de imagen y texto', 'Hazla todavía más llamativa'],
    );
  }

  /* ---------------- Imagen de la biblioteca en una sección (por descripción) */
  const composing = /\b(imagen|foto) (y|con|e) texto\b|\btexto (y|con|e) (imagen|foto)\b/.test(text) || /\b(agrega|crea|anade|inserta) (una|otra) seccion\b/.test(text);
  if (!composing && has(text, 'imagen', 'foto', 'fotografia') && has(text, 'fondo', 'hero', 'portada', 'banner', 'seccion', 'usa', 'pon', 'busca', 'biblioteca', 'mis imagenes', 'mis fotos')) {
    const query = mediaQueryFrom(text);
    const section = has(text, 'hero', 'portada', 'principal') ? 'type:hero' : has(text, 'banner') ? 'type:banner' : /\b(esta|este) seccion\b/.test(text) && selected ? 'selected' : (typeFromWords(text.replace(/(fotos?|imagen(es)?) de .*/, '')) ?? (selected ? 'selected' : 'type:hero'));
    const background = has(text, 'fondo');
    return done(
      query ? `Busqué una imagen de «${query}» en tu biblioteca y la puse${background ? ' de fondo' : ''}.` : `Usé una imagen de tu biblioteca${background ? ' como fondo' : ''}.`,
      [{ action: 'set_image', section, media: query ? { query } : { folder: background ? 'backgrounds' : 'images' }, ...(background ? { target: 'background' } : {}) }],
      ['Oscurece un poco más el fondo', 'Usa otra imagen', 'Cambia el título de esta sección'],
    );
  }

  /* ---------------- Tema: espaciado, esquinas, sombras, ancho */
  if (has(text, 'espacio', 'aire', 'espaciado') && has(text, 'mas', 'menos', 'compact')) {
    const value = has(text, 'menos', 'compact') ? 'compact' : has(text, 'mucho') ? 'spacious' : 'relaxed';
    return done(value === 'compact' ? 'Reduje el espacio entre secciones.' : 'Di más aire entre secciones.', [{ action: 'update_theme', spacing: { sectionPadding: value } }], []);
  }
  if (has(text, 'esquinas', 'bordes', 'redondead')) {
    const radius = has(text, 'recta', 'cuadrad', 'sin redondear') ? 0 : has(text, 'muy', 'mas') ? 20 : 14;
    return done(radius === 0 ? 'Esquinas rectas en todo el sitio.' : 'Redondeé las esquinas de tarjetas, botones e imágenes.', [{ action: 'update_theme', shape: { radius } }], []);
  }
  if (has(text, 'sombra')) {
    const shadow = has(text, 'sin sombra', 'quita') ? 'none' : has(text, 'fuerte', 'marcada') ? 'strong' : 'soft';
    return done(shadow === 'none' ? 'Quité las sombras.' : 'Agregué sombras suaves a tarjetas y bloques.', [{ action: 'update_theme', shape: { shadow } }], []);
  }
  if (has(text, 'ancho completo', 'pantalla completa', 'mas ancho', 'mas angosto')) {
    const maxWidth = has(text, 'angosto') ? 'narrow' : has(text, 'completo', 'completa') ? 'full' : 'wide';
    return done('Cambié el ancho del contenido del sitio.', [{ action: 'update_theme', spacing: { maxWidth } }], []);
  }

  /* ---------------- Eliminar */
  if (has(text, 'elimina', 'borra', 'quita', 'remueve')) {
    if (has(text, 'del menu')) {
      const name = text.match(/(?:quita|elimina|borra|remueve) (?:la pagina |el enlace |el link )?(.+?) del menu/)?.[1];
      return name ? done(`Quito «${name}» del menú. La página sigue existiendo.`, [{ action: 'remove_nav_item', item: name }], []) : done('¿Qué enlace quieres quitar del menú?', [], []);
    }
    if (has(text, 'pagina')) {
      const name = text.match(/pagina (?:de )?([a-z0-9 ]+)$/)?.[1];
      const ref = !name || /\b(esta|actual)\b/.test(text) ? 'current' : name;
      return done('Listo para eliminar la página. Confírmalo abajo.', [{ action: 'delete_page', page: ref }], []);
    }
    const ref = target ?? typeFromWords(text);
    return ref ? done('Preparé la eliminación de la sección. Confírmala abajo.', [{ action: 'delete_section', section: ref }], ['Agrega una sección de contacto']) : done('¿Qué sección quieres eliminar? Selecciónala en la vista previa o dime cuál (por ejemplo "la de testimonios").', [], []);
  }

  /* ---------------- Duplicar */
  if (has(text, 'duplica', 'copia')) {
    if (has(text, 'pagina')) return done('Hice una copia de la página.', [{ action: 'duplicate_page', page: 'current' }], ['Cambia el título de la copia']);
    const ref = target ?? typeFromWords(text);
    return ref ? done('Dupliqué la sección; la copia quedó justo debajo. Dime qué contenido quieres en ella.', [{ action: 'duplicate_section', section: ref }], ['Cambia el título de esta sección']) : done('Selecciona la sección que quieres duplicar.', [], []);
  }

  /* ---------------- Mover */
  if (has(text, 'mueve', 'sube', 'baja', 'coloca', 'reubica', 'pon esta', 'pon la')) {
    const ref = target ?? typeFromWords(text.split(/ (arriba|antes|debajo|despues|abajo|al final|al inicio)/)[0]);
    let position = positionFrom();
    if (!position) position = has(text, 'sube', 'arriba') ? { place: 'up' } : has(text, 'baja', 'abajo') ? { place: 'down' } : undefined;
    if (ref && position) return done('Moví la sección.', [{ action: 'move_section', section: ref, position }], ['Súbela un lugar más']);
    return done('¿Qué sección muevo y a dónde? Por ejemplo: "mueve esta sección arriba de la de productos".', [], []);
  }

  /* ---------------- Sitio completo desde una plantilla */
  if (has(text, 'web', 'sitio', 'plantilla', 'website') && has(text, 'quiero', 'crea', 'hazme', 'arma', 'necesito', 'usa la plantilla', 'aplica la plantilla', 'empieza')) {
    const match = SITE_TEMPLATE_WORDS.find(([words]) => has(text, ...words));
    if (match) {
      const topic = raw.match(/para (?:mi |una |un |el |la )?(.+?)[.!?]*$/i)?.[1]?.replace(/^(empresa|negocio|tienda|local) de /i, '').trim().slice(0, 80);
      const style = PRESET_WORDS.find(([words]) => has(text, ...words));
      const actions: Record<string, unknown>[] = [{ action: 'apply_site_template', template: match[1], ...(topic ? { topic } : {}), mode: has(text, 'agrega', 'sin borrar', 'conserva') ? 'add' : 'replace' }];
      if (style && style[1] !== SITE_TEMPLATES[match[1]].preset) actions.push({ action: 'update_theme', preset: style[1] });
      return done(
        `Preparé un sitio con la plantilla «${SITE_TEMPLATES[match[1]].label}»${topic ? ` para ${topic}` : ''}: páginas, secciones y diseño listos para editar. Revísalo en la vista previa y confírmalo.`,
        actions,
        ['Pon una foto de mi biblioteca en el hero', 'Cambia el color principal', 'Agrega una sección de preguntas frecuentes'],
      );
    }
  }

  /* ---------------- Crear página */
  // "una página de servicios", "página para mi tienda" (y no "que la página se vea…").
  const wantsPage = /\b(una|otra|nueva)\s+pagina\b|\bpagina (de|para|sobre|nueva)\b/.test(text) && !/\b(se vea|luzca|sea mas|este mas)\b/.test(text);
  if (wantsPage) {
    const kind = PAGE_WORDS.find(([words]) => has(text.replace(/para .*/, ''), ...words)) ?? PAGE_WORDS.find(([words]) => has(text, ...words));
    // "para una empresa de limpieza" → "limpieza" (se lee mejor en los textos: "Servicios de limpieza").
    const topic = raw
      .match(/para (?:mi |una |un |el |la |mis )?(.+?)[.!?]*$/i)?.[1]
      ?.replace(/^(empresa|negocio|compa[ñn][íi]a|tienda|local|marca) de /i, '')
      .trim();
    const [blueprint, title] = kind ? [kind[1], kind[2]] : (['blank', 'Nueva página'] as const);
    return done(
      `Preparé una página «${title}»${topic ? ` pensada para ${topic}` : ''} con secciones listas para editar. Revísala en la vista previa y aplícala.`,
      [{ action: 'create_page', title, blueprint, ...(topic ? { topic: topic.slice(0, 80) } : {}) }],
      ['Cambia los textos del hero', 'Agrega una sección de testimonios', 'Cambia el fondo a un color claro'],
    );
  }

  /* ---------------- Columnas de una sección que no es de productos */
  const anyColumns = text.match(/(\d{1,2})\s*(?:columnas|por fila|en fila)/);
  if (anyColumns && selected?.type === 'columns') {
    const n = Math.min(4, Math.max(1, Number(anyColumns[1])));
    const layout = ['1', '1-1', '1-1-1', '1-1-1-1'][n - 1];
    return done(`La sección ahora tiene ${n} columnas.`, [{ action: 'update_section', section: 'selected', content: { layout } }], ['Apílalas en el celular']);
  }
  if (anyColumns && selected && COLUMN_SECTIONS.has(selected.type)) {
    const n = Math.min(6, Math.max(1, Number(anyColumns[1])));
    return done(`La sección ahora usa ${n} columnas en escritorio.`, [{ action: 'update_section', section: 'selected', content: { columns: { desktop: n } } }], ['En el celular, una columna']);
  }

  /* ---------------- Productos: columnas, imagen, layout, filtros */
  const columns = text.match(/(\d)\s*(productos|servicios|columnas|tarjetas|items)?\s*(por fila|por linea|columnas|en fila)/) ?? text.match(/(\d) columnas/);
  const layout = LAYOUT_WORDS.find(([words]) => has(text, ...words));
  const aboutImages = has(text, 'imagen', 'imagenes', 'foto');
  const productRef = productSection();
  if (productRef && (columns || (aboutImages && has(text, 'grande', 'pequen', 'chica', 'mas chic')) || (layout && has(text, 'layout', 'formato', 'muestra', 'mostrar', 'como', 'cambia', 'pon')) || has(text, 'filtro', 'paginacion', 'ver mas', 'mostrar mas', 'mas productos'))) {
    const presentation: Record<string, unknown> = {};
    const catalog: Record<string, unknown> = {};
    const collection: Record<string, unknown> = {};
    if (columns) presentation.columns = { desktop: Math.min(6, Math.max(1, Number(columns[1]))) };
    if (aboutImages && has(text, 'grande')) Object.assign(presentation, { imageSize: 'lg', ratio: 'portrait' }, columns ? {} : { layout: 'largeCards', columns: { desktop: 3 } });
    if (aboutImages && has(text, 'pequen', 'chica')) Object.assign(presentation, { imageSize: 'sm' });
    if (layout) presentation.layout = layout[1];
    const sectionType = productRef === 'selected' ? selected!.type : productRef.slice(5);
    if (has(text, 'filtro')) catalog.filters = { search: true, categories: true, price: true, badges: true };
    if (has(text, 'paginacion', 'ver mas')) catalog.pagination = { mode: 'loadMore', perPage: 12 };
    if (has(text, 'mostrar mas', 'mas productos')) {
      if (sectionType === 'catalog') catalog.pagination = { mode: 'all' };
      else collection.limit = 0;
    }
    if (sectionType !== 'catalog' && Object.keys(catalog).length) {
      return done('Los filtros y la paginación existen en la sección Catálogo. ¿Quieres que agregue una sección de catálogo completo?', [], ['Agrega una sección de catálogo']);
    }
    return done(
      'Ajusté cómo se muestran los productos. Mira la vista previa.',
      [{ action: 'update_product_display', section: productRef, ...(Object.keys(presentation).length ? { presentation } : {}), ...(Object.keys(collection).length ? { collection } : {}), ...(Object.keys(catalog).length ? { catalog } : {}) }],
      ['Cambia el layout a lista de precios', 'Muestra 3 productos por fila', 'Haz las imágenes redondas'],
    );
  }

  /* ---------------- Crear sección */
  if (has(text, 'agrega', 'anade', 'pon ', 'inserta', 'crea', 'quiero una seccion', 'incluye', 'necesito una seccion') && (has(text, 'seccion') || SECTION_WORDS.some(([w]) => has(text, ...w)))) {
    const match = SECTION_WORDS.find(([words]) => has(text.replace(/(arriba|antes|debajo|despues|abajo) de .*/, ''), ...words));
    if (match) {
      const intents = match[1]();
      const position = positionFrom();
      const actions = intents.map((intent, i) => ({ action: 'create_section', section: { ...intent, as: `$s${i}` }, ...(i === 0 ? (position ? { position } : {}) : { position: { after: `$s${i - 1}` } }) }));
      return done(intents.length > 1 ? 'Agregué una franja de promociones y una sección con tus productos en oferta.' : 'Agregué la sección. Puedes editar sus textos en el panel o pedírmelo.', actions, ['Cambia el título de esta sección', 'Cambia el fondo de esta sección', 'Mueve esta sección al final']);
    }
  }

  /* ---------------- Tema: encabezado, preset, colores, tipografía, botones */
  if (has(text, 'encabezado', 'header', 'menu superior', 'barra de navegacion', 'navbar')) {
    const style = HEADER_WORDS.find(([words]) => has(text, ...words));
    if (style) return done('Cambié el estilo del encabezado.', [{ action: 'update_theme', header: { style: style[1] } }], ['Haz el encabezado fijo al hacer scroll', 'Centra el logo']);
  }
  if (has(text, 'fondo')) {
    const color = findColor(text);
    if (color) {
      const onSection = selected && /\b(esta|este) seccion\b/.test(text);
      const onPage = /\b(esta|la) pagina\b/.test(text) && !onSection;
      const target = onSection ? { target: 'section', section: 'selected' } : onPage ? { target: 'page', page: 'current' } : { target: 'site' };
      return done(`Cambié el fondo${onSection ? ' de la sección' : onPage ? ' de la página' : ' del sitio'}.`, [{ action: 'update_background', ...target, background: { type: 'color', color } }], ['Usa un degradado suave', 'Cambia el color principal']);
    }
  }
  if (has(text, 'mas ', 'se vea', 'estilo', 'look', 'diseno', 'tema')) {
    const preset = PRESET_WORDS.find(([words]) => has(text, ...words));
    if (preset) return done('Preparé un cambio de tema completo (colores, tipografía, botones y tarjetas). Confírmalo para aplicarlo.', [{ action: 'update_theme', preset: preset[1] }], ['Cambia el color principal', 'Usa una tipografía más elegante']);
  }
  if (has(text, 'color principal', 'color primario', 'color de marca', 'color de los botones', 'color de acento')) {
    const color = findColor(text);
    if (color) return done('Cambié el color principal.', [{ action: 'update_theme', colors: { primary: color, accent: color, button: color, price: color } }], []);
  }
  if (has(text, 'tipografia', 'fuente', 'letra')) {
    const font = FONTS.find(([word]) => text.includes(word));
    if (font) return done('Cambié la tipografía de los títulos.', [{ action: 'update_theme', typography: { headingFont: font[1] } }], ['Usa la misma fuente en los textos']);
  }
  if (has(text, 'boton')) {
    const shape = has(text, 'redond', 'pildora') ? 'pill' : has(text, 'cuadrad', 'recto') ? 'square' : null;
    if (shape) return done('Cambié la forma de los botones.', [{ action: 'update_theme', buttons: { shape } }], []);
  }

  /* ---------------- Textos */
  const titleChange = raw.match(/t[ií]tulo(?: de (?:esta|la) secci[oó]n)? (?:a|por|que diga) ["“']?(.+?)["”']?$/i);
  if (titleChange && selected) return done('Cambié el título.', [{ action: 'update_section', section: 'selected', content: { title: titleChange[1].slice(0, 160) } }], []);

  /* ---------------- Menú */
  const navAdd = text.match(/(?:agrega|anade|pon) (?:la pagina )?(?:de )?(.+?) (?:al|en el) menu/);
  if (navAdd) return done(`Agregué «${navAdd[1]}» al menú.`, [{ action: 'add_nav_item', kind: 'page', page: navAdd[1] }], []);
  const navHide = text.match(/oculta (?:la pagina )?(?:de )?(.+?) (?:del|en el) menu/);
  if (navHide) return done(`Oculté «${navHide[1]}» del menú.`, [{ action: 'update_nav_item', item: `page:${navHide[1]}`, visible: false }], []);

  return done(
    'Mmm, esa no la entendí 😺. Estoy en modo básico (sin IA), así que funciono mejor con pedidos directos como "agrega una sección de contacto al final" o "4 productos por fila".',
    [],
    ['Crea una página de servicios', 'Agrega una sección de productos destacados', 'Cambia el fondo a un color claro'],
  );
}
