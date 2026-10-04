import 'server-only';
import { z } from 'zod';
import { zodSignature } from '@/lib/assistant/capabilities';
import type { BusinessContext } from '@/lib/auth/session';
import { runTool, TOOL_DESCRIPTIONS, TOOL_SCHEMAS, type ToolContext, type ToolName } from './tools';
import type { ChatMessage, ToolRunner, ToolSpec } from './types';

const SPECS: ToolSpec[] = (Object.keys(TOOL_SCHEMAS) as ToolName[]).map((name) => {
  const { $schema: _schema, ...inputSchema } = z.toJSONSchema(TOOL_SCHEMAS[name], { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  return { name, description: TOOL_DESCRIPTIONS[name], inputSchema, signature: zodSignature(TOOL_SCHEMAS[name]).replace(/^\{ | \}$/g, '') };
});

/** Herramientas atadas al negocio y la sesión de ESTA petición (RLS aplica en cada consulta). */
export function createToolRunner(ctx: BusinessContext, messages: ChatMessage[]): { runner: ToolRunner; toolContext: ToolContext } {
  const toolContext: ToolContext = {
    supabase: ctx.supabase,
    businessId: ctx.business.id,
    catalogId: ctx.catalog.id,
    userText: messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n'),
    stock: new Map(),
    media: new Set(),
  };
  return {
    toolContext,
    runner: { specs: SPECS, run: (name, args) => runTool(name, args, toolContext) },
  };
}

/** Rutas "{negocio}/…" o URLs https usadas en las acciones finales. */
function mediaCandidates(value: unknown, prefix: string, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith(prefix) || /^https:\/\/\S+$/.test(value)) out.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => mediaCandidates(v, prefix, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => mediaCandidates(v, prefix, out));
  return out;
}

/**
 * Imágenes que el editor puede aceptar de esta respuesta: sólo rutas que
 * EXISTEN en la biblioteca del negocio (nunca rutas inventadas por el modelo).
 */
export async function validatedMedia(ctx: BusinessContext, actions: unknown, seen: Set<string>): Promise<string[]> {
  const candidates = [...new Set([...mediaCandidates(actions, `${ctx.business.id}/`), ...seen])].slice(0, 200);
  if (candidates.length === 0) return [];
  const { data } = await ctx.supabase.from('media_assets').select('path').eq('business_id', ctx.business.id).is('deleted_at', null).in('path', candidates);
  return (data ?? []).map((m) => m.path);
}

/** Contexto que agrega el servidor: últimas imágenes y productos del catálogo. */
export async function serverContext(ctx: BusinessContext) {
  const [{ data: media }, { data: items }, { data: categories }] = await Promise.all([
    ctx.supabase.from('media_assets').select('path, name, alt, folder, source').eq('business_id', ctx.business.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(30),
    ctx.supabase.from('catalog_items').select('id, name, type, category_id, price, is_featured').eq('catalog_id', ctx.catalog.id).is('deleted_at', null).order('position').limit(80),
    ctx.supabase.from('categories').select('id, name').eq('catalog_id', ctx.catalog.id).is('deleted_at', null),
  ]);
  // Sólo las imágenes de los (hasta 80) ítems que se envían, no todas las del negocio.
  const ids = (items ?? []).map((i) => i.id);
  const { data: images } = ids.length ? await ctx.supabase.from('catalog_item_images').select('item_id').in('item_id', ids) : { data: [] as { item_id: string }[] };
  const names = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const withImage = new Set((images ?? []).map((i) => i.item_id));
  return {
    media: (media ?? []).map((m) => ({ path: m.path, name: m.name.slice(0, 200), alt: m.alt.slice(0, 300), folder: m.folder, source: m.source })),
    hasLogo: Boolean(ctx.business.logo_path),
    products: (items ?? []).map((i) => ({ id: i.id, name: i.name, type: i.type, category: i.category_id ? (names.get(i.category_id) ?? '') : '', price: i.price, featured: i.is_featured, hasImage: withImage.has(i.id) })),
  };
}
