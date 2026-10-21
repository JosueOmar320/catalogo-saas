import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { foldText } from '@/lib/utils/text';

/**
 * Guía del panel para Garfield (ayuda en todo el panel): qué se hace en cada
 * lugar y su dirección. Garfield sólo puede enlazar a estas áreas (por id),
 * así nunca inventa una ruta. Sin IA, las palabras clave eligen el área.
 */
export type PanelArea = {
  id: string;
  href: string;
  /** Nombre visible (se traduce con t()). */
  title: string;
  /** Qué se hace ahí (para el modelo, en español). */
  summary: string;
  /** Palabras para encontrarla sin IA (sin acentos, en minúsculas; español e inglés). */
  keywords: string[];
  admin?: boolean;
  /** Sólo en un negocio con catálogo (no en un sitio web). */
  catalogOnly?: boolean;
};

export const PANEL_AREAS = [
  { id: 'home', href: '/dashboard', title: msg('Inicio del panel'), summary: 'Progreso de la configuración, visitas al sitio, pedidos por WhatsApp enviados, búsquedas sin resultados, productos por revisar (sin foto, sin precio), uso del plan y accesos rápidos (código QR, kit para compartir, lista de precios).', keywords: ['inicio', 'resumen', 'visitas', 'estadisticas', 'qr', 'compartir', 'kit', 'lista de precios', 'busquedas', 'reporte', 'home', 'stats', 'visits', 'share'] },
  { id: 'orders', href: '/dashboard/pedidos', title: msg('Pedidos'), summary: 'Bandeja de pedidos: cada pedido que los clientes envían por WhatsApp desde el sitio, con su folio. Confirmar, marcar listo, entregado o cancelado (puede descontar existencias), buscar por folio o nombre, filtrar por periodo y descargar en CSV. Se activa o apaga en Contacto y pedidos.', keywords: ['mis pedidos', 'pedidos recibidos', 'pedidos nuevos', 'bandeja', 'bandeja de pedidos', 'folio', 'confirmar pedido', 'entregado', 'historial de pedidos', 'ver pedidos', 'my orders', 'order inbox'], catalogOnly: true },
  { id: 'products', href: '/dashboard/catalog/products', title: msg('Productos'), summary: 'Lista de productos: buscar, editar el precio en la lista, acciones masivas (ocultar, subir o bajar precios con redondeo, etiquetas con QR para imprimir), importar y exportar CSV (también con enlaces de fotos) y crear varios productos desde fotos.', keywords: ['productos', 'producto', 'importar', 'exportar', 'csv', 'excel', 'masivo', 'subir precios', 'precios', 'etiquetas', 'ocultar', 'fotos', 'products', 'import', 'export', 'bulk', 'prices', 'labels'], catalogOnly: true },
  { id: 'services', href: '/dashboard/catalog/services', title: msg('Servicios'), summary: 'Lista de servicios (se cotizan o agendan por WhatsApp; no van al pedido).', keywords: ['servicios', 'servicio', 'cotizar', 'services', 'service'], catalogOnly: true },
  { id: 'new_product', href: '/dashboard/catalog/items/new?type=product', title: msg('Nuevo producto'), summary: 'Crear un producto: fotos, precio y precio anterior (oferta con fecha de fin), opciones (tallas, tamaños), extras, horario, mayoreo, existencias, dieta y alérgenos, costo privado y margen, precio programado, temporada, "Combínalo con", badges, descripción (Garfield puede redactarla).', keywords: ['nuevo producto', 'crear producto', 'agregar producto', 'oferta', 'descuento', 'variantes', 'opciones', 'tallas', 'extras', 'mayoreo', 'existencias', 'stock', 'inventario', 'alergenos', 'costo', 'margen', 'temporada', 'new product', 'add product', 'sale', 'variants', 'inventory'], catalogOnly: true },
  { id: 'new_service', href: '/dashboard/catalog/items/new?type=service', title: msg('Nuevo servicio'), summary: 'Crear un servicio: nombre, descripción, precio "desde" o a cotizar, duración.', keywords: ['nuevo servicio', 'crear servicio', 'agregar servicio', 'new service'], catalogOnly: true },
  { id: 'categories', href: '/dashboard/catalog/categories', title: msg('Categorías'), summary: 'Crear, ordenar y ocultar categorías, con imagen.', keywords: ['categorias', 'categoria', 'secciones del menu', 'categories', 'category'], catalogOnly: true },
  { id: 'attributes', href: '/dashboard/catalog/attributes', title: msg('Atributos'), summary: 'Campos propios para los productos (origen, tamaño, material…) que pueden usarse como filtro en el catálogo y salir en el PDF.', keywords: ['atributos', 'campos', 'filtros', 'filtro', 'caracteristicas', 'attributes', 'filters'], catalogOnly: true },
  { id: 'order', href: '/dashboard/catalog/order', title: msg('Orden'), summary: 'Ordenar productos y categorías arrastrando.', keywords: ['orden', 'ordenar', 'acomodar', 'arrastrar', 'order', 'sort'], catalogOnly: true },
  { id: 'media', href: '/dashboard/media', title: msg('Medios'), summary: 'Biblioteca de imágenes del negocio: subir, buscar, ver dónde se usa cada una y borrar.', keywords: ['medios', 'imagenes', 'imagen', 'fotos', 'biblioteca', 'subir fotos', 'media', 'images', 'photos', 'library'] },
  { id: 'reviews', href: '/dashboard/resenas', title: msg('Reseñas'), summary: 'Reseñas de los clientes: activarlas en el sitio, aprobarlas para publicarlas u ocultarlas.', keywords: ['resenas', 'resena', 'opiniones', 'calificaciones', 'estrellas', 'reviews', 'ratings'], catalogOnly: true },
  { id: 'site', href: '/dashboard/sitio', title: msg('Editor del sitio'), summary: 'Páginas y secciones del sitio web (agregar, ordenar, editar textos e imágenes, estilos por sección, animaciones, plantillas de sección guardadas, plantillas de sitio completo). Garfield está dentro del editor y puede hacer los cambios por ti.', keywords: ['sitio', 'pagina', 'paginas', 'seccion', 'secciones', 'web', 'portada', 'hero', 'banner', 'galeria', 'plantilla', 'editor', 'html', 'widget', 'site', 'page', 'section', 'website', 'template'] },
  { id: 'site_navigation', href: '/dashboard/sitio?panel=navigation', title: msg('Menú, header y pie de página'), summary: 'Menú del sitio con submenús, estilo del header, barra de anuncios, ventana de bienvenida con cupón y pie de página con columnas de enlaces.', keywords: ['menu', 'submenu', 'navegacion', 'header', 'encabezado', 'pie de pagina', 'footer', 'anuncio', 'barra de anuncios', 'ventana de bienvenida', 'popup', 'navigation', 'announcement'] },
  { id: 'site_design', href: '/dashboard/sitio?panel=design', title: msg('Diseño del sitio'), summary: 'Tema, colores, tipografía, estilo de botones, fondo global, tarjetas de producto y CSS propio (si el administrador lo habilitó).', keywords: ['diseno', 'colores', 'color', 'tipografia', 'fuente', 'letra', 'tema', 'botones', 'tarjetas', 'fondo', 'css', 'design', 'colors', 'font', 'theme'] },
  { id: 'pdf', href: '/dashboard/export/pdf', title: msg('Catálogo PDF'), summary: 'Armar y descargar el catálogo en PDF: plantilla, portada, encabezado y pie, bloques y cómo se ven los productos. Garfield también está ahí.', keywords: ['pdf', 'imprimir', 'folleto', 'descargar catalogo', 'print', 'brochure'], catalogOnly: true },
  { id: 'settings_business', href: '/dashboard/settings/negocio', title: msg('Datos del negocio'), summary: 'Nombre, slogan, descripción, dirección del catálogo (enlace), moneda, idioma del sitio y formato de precios.', keywords: ['negocio', 'nombre', 'slogan', 'descripcion del negocio', 'moneda', 'idioma', 'direccion del catalogo', 'enlace', 'url', 'business', 'currency', 'language'] },
  { id: 'settings_contact', href: '/dashboard/settings/contacto', title: msg('Contacto y pedidos'), summary: 'WhatsApp, teléfono, dirección y mapa; horarios y días especiales; botones de contacto; pedidos por WhatsApp: recoger o envío, costo de envío y envío gratis, zonas de entrega, pedido mínimo, día y hora, propina, pedidos en mesa, sucursales, cupones de descuento, promociones automáticas y pausar pedidos.', keywords: ['contacto', 'whatsapp', 'telefono', 'direccion', 'mapa', 'horario', 'horarios', 'dias festivos', 'pedidos', 'pedido', 'envio', 'domicilio', 'zonas', 'minimo', 'cupon', 'cupones', 'cupon de descuento', 'cupones de descuento', 'codigo de descuento', 'promocion', 'promociones', 'propina', 'mesa', 'mesas', 'sucursal', 'sucursales', 'pausar', 'contact', 'orders', 'delivery', 'coupon', 'hours', 'branches'] },
  { id: 'settings_social', href: '/dashboard/settings/redes', title: msg('Redes sociales'), summary: 'Enlaces a Instagram, Facebook, TikTok y otras redes.', keywords: ['redes', 'instagram', 'facebook', 'tiktok', 'social'] },
  { id: 'settings_seo', href: '/dashboard/settings/seo', title: msg('SEO'), summary: 'Título y descripción para Google y al compartir el enlace, imagen para compartir y ocultar de buscadores. Garfield puede redactarlos.', keywords: ['seo', 'google', 'buscadores', 'compartir enlace', 'descripcion para google', 'search engines'] },
  { id: 'settings_publishing', href: '/dashboard/settings/publicacion', title: msg('Publicación'), summary: 'Publicar o despublicar el sitio y copiar el enlace público.', keywords: ['publicar', 'publico', 'publico mi sitio', 'publicar mi sitio', 'publicar el sitio', 'publicacion', 'despublicar', 'enlace publico', 'link', 'en linea', 'publish', 'unpublish'] },
  { id: 'account', href: '/cuenta', title: msg('Mi cuenta'), summary: 'Datos personales, idioma de la aplicación, contraseña y el aviso semanal por correo.', keywords: ['cuenta', 'perfil', 'contrasena', 'idioma de la app', 'correo', 'aviso semanal', 'account', 'password', 'profile'] },
  { id: 'admin_businesses', href: '/admin/negocios', title: msg('Negocios (administración)'), summary: 'Crear negocios, cambiar su plan o suspenderlos, dar acceso a usuarios y habilitar el código propio por negocio.', keywords: ['negocios', 'crear negocio', 'plan', 'suspender', 'codigo propio', 'businesses'], admin: true },
  { id: 'admin_users', href: '/admin/usuarios', title: msg('Usuarios (administración)'), summary: 'Crear usuarios, restablecer contraseñas, desactivarlos y asignarles negocios.', keywords: ['usuarios', 'crear usuario', 'contrasena', 'desactivar', 'users'], admin: true },
  { id: 'admin_settings', href: '/admin/configuracion', title: msg('Configuración de la plataforma'), summary: 'Estado de la IA de Garfield, avisos por correo y planes (incluido el código propio por plan).', keywords: ['configuracion', 'planes', 'ia', 'correo', 'resend', 'settings', 'plans'], admin: true },
] as const satisfies readonly PanelArea[];

export type PanelAreaId = (typeof PANEL_AREAS)[number]['id'];
export const PANEL_AREA_IDS = PANEL_AREAS.map((area) => area.id) as [PanelAreaId, ...PanelAreaId[]];

export const areasFor = (admin: boolean, catalog = true): readonly PanelArea[] =>
  PANEL_AREAS.filter((area: PanelArea) => (admin || !area.admin) && (catalog || !area.catalogOnly));
export const findArea = (id: string): PanelArea | undefined => PANEL_AREAS.find((area) => area.id === id);

/** Las áreas que mejor coinciden con la pregunta (sin IA): las frases largas pesan más. */
export function matchAreas(question: string, admin = false, limit = 3, catalog = true): PanelArea[] {
  const text = ` ${foldText(question).replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ')} `;
  return areasFor(admin, catalog)
    .map((area) => ({ area, score: area.keywords.reduce((sum, keyword) => (text.includes(` ${keyword} `) || (keyword.length > 5 && text.includes(keyword)) ? sum + keyword.split(' ').length : sum), 0) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((match) => match.area);
}

export const helpRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(16)
    .refine((list) => list[list.length - 1].role === 'user', 'El último mensaje debe ser del usuario'),
  /** Dónde está el usuario (para "aquí", "esta pantalla"). */
  path: z.string().max(200).default('/dashboard'),
});

export const helpResultSchema = z.object({
  message: z.string().min(1).max(1500),
  links: z.array(z.enum(PANEL_AREA_IDS)).max(3).default([]),
  suggestions: z.array(z.string().max(80)).max(3).default([]),
});
export type HelpResult = z.output<typeof helpResultSchema>;
