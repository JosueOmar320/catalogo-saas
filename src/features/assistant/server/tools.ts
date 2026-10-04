import { z } from 'zod';
import { env } from '@/lib/env';
import type { ServerSupabase } from '@/lib/supabase/server';
import { findMedia, importFromUrl, MediaError } from '@/features/media/service';

/**
 * Herramientas de SERVIDOR de Garfield: consultas (con la sesión del usuario,
 * RLS) y una sola herramienta con efecto, `import_image`, que es aditiva
 * (agrega una imagen a la biblioteca del negocio). Todo lo demás —páginas,
 * secciones, productos— son ACCIONES propuestas que el usuario aplica.
 *
 * Cada herramienta: valida parámetros (Zod), trabaja sólo sobre el negocio de
 * la sesión y devuelve un resultado corto y claro para el modelo.
 */

export type ToolContext = {
  supabase: ServerSupabase;
  businessId: string;
  catalogId: string;
  /** Texto de los mensajes del usuario: sólo se importan URLs que el usuario escribió. */
  userText: string;
  /** Resultados de search_stock_images de esta conversación (ref → imagen). */
  stock: Map<string, StockImage>;
  /** Rutas de imagen que el modelo vio o creó en esta vuelta (se envían al editor). */
  media: Set<string>;
  fetch?: typeof fetch;
};

type StockImage = { ref: string; url: string; title: string; creator: string | null; license: string; provider: string; width: number | null; height: number | null; sourcePage: string | null };

const STOCK_HOSTS = ['upload.wikimedia.org', 'cdn.stocksnap.io', 'images.rawpixel.com', 'pd.w.org', 'live.staticflickr.com', 'farm1.staticflickr.com', 'images.pexels.com'];

/* ------------------------------------------------------------ Definiciones */

export const TOOL_SCHEMAS = {
  search_products: z.object({
    query: z.string().max(80).optional().describe('Texto a buscar en nombre, código o descripción.'),
    category: z.string().max(80).optional().describe('Id o nombre de categoría.'),
    type: z.enum(['product', 'service']).optional(),
    featured: z.boolean().optional(),
    onSale: z.boolean().optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  list_categories: z.object({}),
  search_media: z.object({
    query: z.string().max(80).optional().describe('Palabras del nombre o la descripción de la imagen ("comida", "fachada").'),
    folder: z.enum(['images', 'logos', 'products', 'backgrounds', 'banners', 'other']).optional(),
    limit: z.number().int().min(1).max(24).optional(),
  }),
  search_stock_images: z.object({
    query: z.string().min(2).max(80).describe('Qué buscar, idealmente en INGLÉS ("restaurant interior", "cleaning service").'),
    orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  import_image: z.object({
    ref: z.string().max(80).optional().describe('ref de un resultado de search_stock_images.'),
    url: z.string().url().max(1000).optional().describe('Sólo una URL https que el USUARIO escribió en el chat.'),
    alt: z.string().min(2).max(200).describe('Descripción corta de la imagen en español.'),
    use: z.enum(['section', 'product', 'category']).optional().describe('Dónde se usará (define la carpeta).'),
  }),
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  search_products: 'Busca productos y servicios del catálogo (id, nombre, categoría, precio, destacado, imagen).',
  list_categories: 'Lista las categorías del catálogo con la cantidad de ítems.',
  search_media: 'Busca imágenes en la biblioteca del negocio (subidas, importadas o adjuntas en el chat). Devuelve rutas utilizables.',
  search_stock_images: 'Busca fotos libres (dominio público/CC0, sin atribución obligatoria) en Openverse. Luego usa import_image con el ref elegido.',
  import_image: 'Descarga una imagen (de search_stock_images o de una URL que dio el usuario) a la biblioteca del negocio y devuelve su ruta para usarla en acciones.',
};

export const isToolName = (name: string): name is ToolName => name in TOOL_SCHEMAS;

/* ------------------------------------------------------------ Ejecución */

export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  if (!isToolName(name)) return { ok: false, error: `Herramienta desconocida: ${name}` };
  const parsed = TOOL_SCHEMAS[name].safeParse(rawArgs ?? {});
  if (!parsed.success) return { ok: false, error: `Parámetros inválidos: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}` };
  try {
    switch (name) {
      case 'search_products':
        return { ok: true, result: await searchProducts(ctx, parsed.data as z.infer<typeof TOOL_SCHEMAS.search_products>) };
      case 'list_categories':
        return { ok: true, result: await listCategories(ctx) };
      case 'search_media':
        return { ok: true, result: await searchMedia(ctx, parsed.data as z.infer<typeof TOOL_SCHEMAS.search_media>) };
      case 'search_stock_images':
        return { ok: true, result: await searchStock(ctx, parsed.data as z.infer<typeof TOOL_SCHEMAS.search_stock_images>) };
      case 'import_image':
        return { ok: true, result: await importImage(ctx, parsed.data as z.infer<typeof TOOL_SCHEMAS.import_image>) };
    }
  } catch (error) {
    return { ok: false, error: error instanceof ToolError ? error.message : 'La herramienta falló. Intenta con otra opción.' };
  }
}

class ToolError extends Error {}

/* ------------------------------------------------------------ Catálogo */

async function listCategories(ctx: ToolContext) {
  const [{ data: categories }, { data: items }] = await Promise.all([
    ctx.supabase.from('categories').select('id, name, is_active, position').eq('catalog_id', ctx.catalogId).is('deleted_at', null).order('position'),
    ctx.supabase.from('catalog_items').select('category_id').eq('catalog_id', ctx.catalogId).is('deleted_at', null),
  ]);
  return (categories ?? []).map((c) => ({ id: c.id, name: c.name, active: c.is_active, items: (items ?? []).filter((i) => i.category_id === c.id).length }));
}

async function searchProducts(ctx: ToolContext, args: z.infer<typeof TOOL_SCHEMAS.search_products>) {
  let query = ctx.supabase
    .from('catalog_items')
    .select('id, name, type, category_id, price, compare_at_price, sku, is_featured, is_available, is_visible, short_description')
    .eq('catalog_id', ctx.catalogId)
    .is('deleted_at', null)
    .order('position')
    .limit(args.limit ?? 20);
  if (args.type) query = query.eq('type', args.type);
  if (args.featured !== undefined) query = query.eq('is_featured', args.featured);
  if (args.onSale) query = query.not('compare_at_price', 'is', null);
  if (args.query) {
    const q = args.query.replace(/[%,()]/g, ' ').trim();
    if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,short_description.ilike.%${q}%`);
  }
  const categories = await listCategories(ctx);
  if (args.category) {
    const key = args.category.toLowerCase();
    const category = categories.find((c) => c.id === args.category || c.name.toLowerCase() === key) ?? categories.find((c) => c.name.toLowerCase().includes(key));
    if (!category) return { items: [], note: `No existe la categoría "${args.category}". Categorías: ${categories.map((c) => c.name).join(', ') || 'ninguna'}.` };
    query = query.eq('category_id', category.id);
  }
  const { data: items } = await query;
  const ids = (items ?? []).map((i) => i.id);
  const { data: images } = ids.length ? await ctx.supabase.from('catalog_item_images').select('item_id, storage_path, position').in('item_id', ids).order('position') : { data: [] };
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return {
    items: (items ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      category: i.category_id ? (names.get(i.category_id) ?? null) : null,
      price: i.price,
      compareAtPrice: i.compare_at_price,
      sku: i.sku,
      featured: i.is_featured,
      available: i.is_available,
      visible: i.is_visible,
      description: i.short_description?.slice(0, 120) ?? null,
      image: (images ?? []).find((im) => im.item_id === i.id)?.storage_path ?? null,
    })),
  };
}

/* ------------------------------------------------------------ Medios */

async function searchMedia(ctx: ToolContext, args: z.infer<typeof TOOL_SCHEMAS.search_media>) {
  const found = await findMedia({ supabase: ctx.supabase, businessId: ctx.businessId }, { query: args.query, folder: args.folder, limit: args.limit ?? 12 });
  for (const m of found) ctx.media.add(m.path);
  return { images: found.map((m) => ({ path: m.path, name: m.name, alt: m.alt, folder: m.folder, width: m.width, height: m.height, external: m.provider === 'external' })) };
}

async function searchStock(ctx: ToolContext, args: z.infer<typeof TOOL_SCHEMAS.search_stock_images>) {
  const params = new URLSearchParams({
    q: args.query,
    license: 'cc0,pdm',
    page_size: String(Math.min((args.limit ?? 6) * 2, 16)),
    mature: 'false',
    size: 'large',
    ...(args.orientation ? { aspect_ratio: args.orientation === 'landscape' ? 'wide' : args.orientation === 'portrait' ? 'tall' : 'square' } : {}),
  });
  const response = await (ctx.fetch ?? fetch)(`https://api.openverse.org/v1/images/?${params}`, { signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': `${env.appName} (catalog builder)` } });
  if (!response.ok) throw new ToolError('El banco de imágenes no respondió. Intenta con otras palabras.');
  const data = (await response.json()) as { results?: Record<string, unknown>[] };
  const results = (data.results ?? [])
    .map((r) => {
      const url = downloadUrl(String(r.url ?? ''));
      const type = String(r.filetype ?? '').toLowerCase();
      if (!url || !['jpg', 'jpeg', 'png', ''].includes(type)) return null;
      const image: StockImage = {
        ref: `stock-${String(r.id).slice(0, 12)}`,
        url,
        title: String(r.title ?? '').slice(0, 120),
        creator: r.creator ? String(r.creator).slice(0, 80) : null,
        license: String(r.license ?? 'cc0'),
        provider: String(r.provider ?? ''),
        width: typeof r.width === 'number' ? r.width : null,
        height: typeof r.height === 'number' ? r.height : null,
        sourcePage: typeof r.foreign_landing_url === 'string' ? r.foreign_landing_url : null,
      };
      return image;
    })
    .filter((r): r is StockImage => r !== null && STOCK_HOSTS.includes(new URL(r.url).hostname))
    .slice(0, args.limit ?? 6);
  for (const r of results) ctx.stock.set(r.ref, r);
  return {
    results: results.map((r) => ({ ref: r.ref, title: r.title, provider: r.provider, width: r.width, height: r.height })),
    note: results.length ? 'Elige el ref más adecuado (por título y proporción) y llama a import_image.' : 'Sin resultados: prueba con palabras en inglés más generales.',
  };
}

/** Wikimedia: pedir una versión de 1600 px en lugar del original (suele pesar >5 MB). */
function downloadUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    const wiki = u.hostname === 'upload.wikimedia.org' && u.pathname.match(/^\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/);
    if (wiki) return `https://upload.wikimedia.org/wikipedia/commons/thumb/${wiki[1]}/${wiki[2]}/${wiki[3]}/1600px-${wiki[3]}`;
    return u.toString();
  } catch {
    return null;
  }
}

async function importImage(ctx: ToolContext, args: z.infer<typeof TOOL_SCHEMAS.import_image>) {
  let source: 'stock' | 'import';
  let url: string;
  let attribution: string | null = null;
  let sourceUrl: string;
  if (args.ref) {
    const stock = ctx.stock.get(args.ref);
    if (!stock) throw new ToolError('Ese ref no viene de search_stock_images en esta conversación.');
    source = 'stock';
    url = stock.url;
    sourceUrl = stock.sourcePage ?? stock.url;
    attribution = [stock.title, stock.creator && `por ${stock.creator}`, `${stock.license.toUpperCase()} vía ${stock.provider || 'Openverse'}`].filter(Boolean).join(' · ').slice(0, 300);
  } else if (args.url) {
    // Anti-inyección: sólo URLs que el usuario escribió (no las que aparezcan en otros datos).
    if (!ctx.userText.includes(args.url)) throw new ToolError('Sólo puedo importar URLs que el usuario escribió en el chat.');
    source = 'import';
    url = args.url;
    sourceUrl = args.url;
  } else {
    throw new ToolError('Indica ref (de search_stock_images) o url.');
  }

  const folder = args.use === 'product' || args.use === 'category' ? 'products' : 'images';
  let record;
  try {
    record = await importFromUrl({ supabase: ctx.supabase, businessId: ctx.businessId }, url, { name: args.alt, alt: args.alt, folder, source, sourceUrl, attribution }, ctx.fetch);
  } catch (error) {
    throw new ToolError(error instanceof MediaError ? error.message : 'No se pudo guardar la imagen en la biblioteca.');
  }
  ctx.media.add(record.path);
  return { path: record.path, alt: args.alt, width: record.width, height: record.height, url: record.url };
}

/* ------------------------------------------------------------ Descarga segura (anti-SSRF) */

// Compartida con la biblioteca y el PDF: lib/net/safe-fetch.ts.
export { imageSize, isPrivateAddress, safeDownload } from '@/lib/net/safe-fetch';
