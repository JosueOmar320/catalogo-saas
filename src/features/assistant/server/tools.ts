import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import { env } from '@/lib/env';
import type { ServerSupabase } from '@/lib/supabase/server';
import { publicStorageUrl } from '@/lib/utils/storage';

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

const MAX_BYTES = 5 * 1024 * 1024; // límite del bucket
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
    query: z.string().max(80).optional().describe('Palabras de la descripción (alt) de la imagen.'),
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
  let query = ctx.supabase
    .from('media_assets')
    .select('path, alt, width, height, source, kind, created_at')
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 12);
  const words = (args.query ?? '').split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
  if (words.length) query = query.or(words.map((w) => `alt.ilike.%${w.replace(/[%,()]/g, '')}%`).join(','));
  const { data } = await query;
  for (const m of data ?? []) ctx.media.add(m.path);
  return { images: (data ?? []).map((m) => ({ path: m.path, alt: m.alt, width: m.width, height: m.height, source: m.source })) };
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

  const image = await safeDownload(url, ctx.fetch ?? fetch);
  const folder = args.use === 'product' ? 'items' : args.use === 'category' ? 'category' : 'site';
  const path = `${ctx.businessId}/${folder}/${crypto.randomUUID()}.${image.extension}`;
  const { error } = await ctx.supabase.storage.from(env.storageBucket).upload(path, image.data, { contentType: image.mime, cacheControl: '31536000', upsert: false });
  if (error) throw new ToolError('No se pudo guardar la imagen en la biblioteca.');
  const { error: dbError } = await ctx.supabase.from('media_assets').insert({
    business_id: ctx.businessId,
    path,
    kind: folder,
    mime_type: image.mime,
    width: image.width,
    height: image.height,
    size_bytes: image.data.byteLength,
    alt: args.alt,
    source,
    source_url: sourceUrl.slice(0, 1000),
    attribution,
  });
  if (dbError) {
    await ctx.supabase.storage.from(env.storageBucket).remove([path]);
    throw new ToolError('No se pudo registrar la imagen.');
  }
  ctx.media.add(path);
  return { path, alt: args.alt, width: image.width, height: image.height, url: publicStorageUrl(path) };
}

/* ------------------------------------------------------------ Descarga segura (anti-SSRF) */

type Downloaded = { data: Uint8Array; mime: 'image/jpeg' | 'image/png' | 'image/webp'; extension: 'jpg' | 'png' | 'webp'; width: number | null; height: number | null };

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (version === 6) {
    const v6 = address.toLowerCase();
    if (v6.startsWith('::ffff:') && isIP(v6.slice(7)) === 4) return isPrivateAddress(v6.slice(7));
    return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff');
  }
  return true;
}

async function assertPublicHttps(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ToolError('La URL no es válida.');
  }
  if (url.protocol !== 'https:') throw new ToolError('Sólo se aceptan URLs https.');
  if (url.username || url.password) throw new ToolError('La URL no es válida.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new ToolError('Esa dirección no está permitida.');
  return url;
}

function sniff(bytes: Uint8Array): Pick<Downloaded, 'mime' | 'extension'> | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: 'image/png', extension: 'png' };
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}

/** Ancho y alto sin librerías (PNG: IHDR · JPEG: marcador SOF). */
export function imageSize(bytes: Uint8Array): { width: number | null; height: number | null } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x89 && bytes.length > 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + length;
    }
  }
  return { width: null, height: null };
}

export async function safeDownload(raw: string, fetchImpl: typeof fetch): Promise<Downloaded> {
  let url = await assertPublicHttps(raw);
  let response: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': `${env.appName} (catalog builder)`, Accept: 'image/jpeg,image/png,image/webp' } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      url = await assertPublicHttps(new URL(location, url).toString());
      continue;
    }
    break;
  }
  if (!response || !response.ok || !response.body) throw new ToolError('No se pudo descargar la imagen.');
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new ToolError('La imagen pesa más de 5 MB.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ToolError('La imagen pesa más de 5 MB.');
    }
    chunks.push(value);
  }
  const data = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const type = sniff(data);
  if (!type) throw new ToolError('El archivo no es una imagen JPG, PNG o WebP.');
  return { data, ...type, ...imageSize(data) };
}
