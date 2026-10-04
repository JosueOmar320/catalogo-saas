import { findMedia, type MediaScope } from '@/features/media/service';
import type { MediaRecord } from '@/features/media/schema';
import type { AnyAction } from '@/lib/assistant/modes';
import type { MediaFolder } from '@/types/database';

/**
 * Referencias simbólicas a imágenes → rutas reales de la biblioteca.
 *
 * Las acciones pueden pedir una imagen por descripción en lugar de una ruta
 * (`media: { query: "comida" }`, `{ latest: 6 }`, `{ folder: "logos" }`).
 * Así el modo local (sin IA) también puede "buscar una foto de comida y
 * ponerla en el hero". Se resuelve SIEMPRE en el servidor, contra la
 * biblioteca del negocio de la sesión: el editor nunca recibe rutas que no
 * existan.
 */

type MediaQuery = { query?: string; folder?: MediaFolder; latest?: number };
type Mutable = Record<string, unknown>;

export type ResolveResult = { actions: AnyAction[]; notes: string[]; seen: Set<string> };

/**
 * Si la biblioteca no tiene lo pedido: buscar fotos libres (CC0 / dominio
 * público) y agregarlas a la biblioteca. Devuelve las rutas importadas.
 */
export type StockFallback = (query: string, count: number) => Promise<string[]>;

/** Máximo de fotos libres importadas por respuesta (cada una se descarga y procesa). */
const MAX_STOCK_IMPORTS = 10;

const describe = (q: MediaQuery) => (q.query ? `«${q.query}»` : q.folder === 'logos' ? 'un logo' : 'imágenes');

export async function resolveMediaQueries(scope: MediaScope, actions: AnyAction[], find: typeof findMedia = findMedia, stock?: StockFallback): Promise<ResolveResult> {
  const notes: string[] = [];
  const seen = new Set<string>();
  const out: AnyAction[] = [];
  const used = new Set<string>();
  const imported: string[] = [];

  const pick = async (q: MediaQuery, count: number, opts: { storageOnly?: boolean } = {}): Promise<MediaRecord[]> => {
    let found = await find(scope, { query: q.query, folder: q.folder, limit: Math.max(count * 2, 8) });
    // La biblioteca no tiene esa imagen: fotos libres importadas a la biblioteca (nunca para logos).
    const fresh0 = found.filter((m) => !used.has(m.path));
    if (fresh0.length < count && q.query && q.folder !== 'logos' && stock && imported.length < MAX_STOCK_IMPORTS) {
      const wanted = Math.min(count - fresh0.length, MAX_STOCK_IMPORTS - imported.length);
      const paths = await stock(q.query, wanted).catch(() => []);
      if (paths.length) {
        imported.push(...paths);
        notes.push(`Tu biblioteca no tenía imágenes de «${q.query}», así que busqué fotos libres (CC0) y agregué ${paths.length} a Medios.`);
        found = [...fresh0, ...paths.map((path) => ({ path, provider: 'supabase' }) as MediaRecord)];
      }
    }
    // Sin coincidencias por palabras: si pidió "las últimas N", se usan las más recientes.
    if (found.length === 0 && q.query && q.latest) found = await find(scope, { folder: q.folder, limit: count * 2 });
    // Carpeta vacía (p. ej. "Fondos"): cualquier imagen sirve, salvo para logos.
    if (found.length === 0 && q.folder && q.folder !== 'logos' && !q.query) found = await find(scope, { limit: Math.max(count * 2, 8) });
    if (opts.storageOnly) found = found.filter((m) => m.provider !== 'external');
    // Evita repetir la misma imagen en acciones distintas de la misma respuesta.
    const fresh = found.filter((m) => !used.has(m.path));
    const chosen = (fresh.length >= count ? fresh : found).slice(0, count);
    chosen.forEach((m) => {
      used.add(m.path);
      seen.add(m.path);
    });
    return chosen;
  };

  /**
   * `media` dentro del contenido o el estilo de una sección (lo que el modelo
   * escribe al crear páginas completas):
   *   content.image: {media}            → {path}
   *   members[].photo: {media}          → "ruta"
   *   style.background: {type: "image", media} → image.path
   *   images: [{media: {latest: 6}}]    → 6 imágenes {path, caption}
   */
  const isQuery = (v: unknown): v is MediaQuery => Boolean(v) && typeof v === 'object' && !Array.isArray(v) && ('query' in (v as object) || 'latest' in (v as object) || 'folder' in (v as object));
  const nested = async (value: unknown, key = ''): Promise<unknown> => {
    if (Array.isArray(value)) {
      const list: unknown[] = [];
      for (const item of value) {
        const media = item && typeof item === 'object' && !Array.isArray(item) ? (item as Mutable).media : undefined;
        if (isQuery(media) && (key === 'images' || key === 'logos')) {
          const { media: _m, ...rest } = item as Mutable;
          const hits = await pick(media, Math.min(media.latest ?? 1, 12));
          if (!hits.length) notes.push(`No encontré ${describe(media)} para las imágenes.`);
          list.push(...hits.map((m) => ({ caption: '', ...rest, path: m.path })));
        } else list.push(await nested(item, key));
      }
      return list;
    }
    if (!value || typeof value !== 'object') return value;
    const obj = value as Mutable;
    const media = obj.media;
    if (isQuery(media)) {
      const [hit] = await pick(media, 1);
      if (!hit) notes.push(`No encontré ${describe(media)} en tu biblioteca.`);
      const { media: _m, ...rest } = obj;
      if (key === 'photo' || key === 'imagePath') return hit?.path ?? null;
      // Fondo: la ruta va en background.image.path.
      if (rest.type === 'image' || key === 'background') {
        return { ...rest, type: hit ? 'image' : (rest.type ?? 'inherit'), image: { ...((rest.image as Mutable) ?? {}), path: hit?.path ?? null } };
      }
      return { ...(await nested(rest, key) as Mutable), path: hit?.path ?? null };
    }
    const out: Mutable = {};
    for (const [k, v] of Object.entries(obj)) out[k] = await nested(v, k);
    return out;
  };
  const SECTION_ACTIONS = new Set(['create_page', 'create_section', 'update_section', 'duplicate_section', 'update_background']);

  for (const original of actions) {
    let action = structuredClone(original) as Mutable & AnyAction;
    if (SECTION_ACTIONS.has(action.action)) {
      const { action: name, ...rest } = action;
      action = { action: name, ...((await nested(rest)) as Mutable) } as Mutable & AnyAction;
    }
    const media = action.media as MediaQuery | undefined;
    delete action.media;
    if (!media) {
      out.push(action);
      continue;
    }
    switch (action.action) {
      case 'set_image': {
        if (!action.path) {
          const [hit] = await pick(media, 1);
          if (hit) action.path = hit.path;
          else notes.push(`No encontré ${describe(media)} en tu biblioteca.`);
        }
        break;
      }
      case 'add_gallery_images': {
        if (!Array.isArray(action.images) || action.images.length === 0) {
          const hits = await pick(media, media.latest ?? 6);
          if (hits.length) action.images = hits.map((m) => ({ path: m.path, caption: '' }));
          else notes.push(`No encontré ${describe(media)} para la galería.`);
        }
        break;
      }
      case 'set_logo': {
        if (!action.path) {
          const [hit] = await pick({ folder: 'logos', ...media }, 1, { storageOnly: true });
          if (hit) action.path = hit.path;
          else notes.push('No encontré un logo en tu biblioteca (carpeta Logos).');
        }
        break;
      }
      case 'update_pdf_cover': {
        if (!action.imagePath) {
          const [hit] = await pick(media, 1);
          if (hit) action.imagePath = hit.path;
          else notes.push(`No encontré ${describe(media)} para la portada.`);
        }
        break;
      }
      case 'add_pdf_block':
      case 'update_pdf_block': {
        const fields = { ...((action.fields as Mutable | undefined) ?? {}) };
        const type = action.action === 'add_pdf_block' ? (action.type as string) : String(fields.type ?? '');
        if (type === 'gallery' || (media.latest && !fields.imagePath)) {
          const hits = await pick(media, media.latest ?? 6);
          if (hits.length) Object.assign(fields, { source: 'custom', images: hits.map((m) => ({ path: m.path, caption: '' })) });
          else notes.push(`No encontré ${describe(media)} para la galería.`);
        } else if (!fields.imagePath) {
          const [hit] = await pick(media, 1);
          if (hit) fields.imagePath = hit.path;
          else notes.push(`No encontré ${describe(media)} en tu biblioteca.`);
        }
        action.fields = fields;
        break;
      }
      default:
        break;
    }
    out.push(action);
  }

  // "Usa el logo en el encabezado": además del logo del negocio, mostrarlo en el header del sitio.
  const logo = out.find((a): a is Extract<AnyAction, { action: 'set_logo' }> => a.action === 'set_logo');
  if (logo?.path && logo.showInHeader !== false && !out.some((a) => a.action === 'update_theme')) {
    out.push({ action: 'update_theme', header: { showLogo: true } } as AnyAction);
  }
  return { actions: out, notes, seen };
}
