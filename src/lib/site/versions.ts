import { parseTheme, type ThemeConfig } from '@/lib/design/theme';
import { parseNavigation, type NavigationConfig } from '@/lib/site/navigation';
import { pageFromRow, type SitePage } from '@/lib/site/pages';

/**
 * Historial de versiones del sitio: cada guardado del editor deja una copia
 * (tema, navegación y páginas) en site_versions. Puro: lo usan el servidor
 * (al abrir una versión) y las pruebas.
 */
export type SiteVersionSummary = { id: string; label: string | null; author: string | null; createdAt: string; pageCount: number };

export type SiteSnapshot = { theme: ThemeConfig; navigation: NavigationConfig; pages: SitePage[] };

const MEDIA_KEYS = ['path', 'photo', 'imagePath', 'ogImagePath'];

/** La copia guardada → datos del editor, tolerante a versiones viejas del esquema. null si no trae páginas. */
export function parseSiteSnapshot(raw: unknown): SiteSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { theme?: unknown; navigation?: unknown; pages?: unknown };
  const rows = Array.isArray(value.pages) ? value.pages : [];
  const pages = rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || typeof row.slug !== 'string') return [];
    return [pageFromRow({ title: '', template: 'custom', is_home: false, is_published: true, sections: [], style: {}, seo: {}, ...row })];
  });
  if (pages.length === 0) return null;
  // Siempre una página de inicio (publicada), como exige el guardado.
  const home = pages.find((p) => p.isHome) ?? pages[0];
  return {
    theme: parseTheme(value.theme),
    navigation: parseNavigation(value.navigation),
    pages: pages.map((p) => ({ ...p, isHome: p.id === home.id, isPublished: p.id === home.id || p.isPublished })),
  };
}

/**
 * Quita las imágenes que ya no son válidas (borradas de la biblioteca): la
 * foto suelta queda vacía y en una galería o lista se quita el elemento.
 */
export function dropMediaRefs<T>(value: T, invalid: ReadonlySet<string>): T {
  const isBad = (v: unknown) => typeof v === 'string' && invalid.has(v);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      // Galerías y logos: el elemento ES la imagen (su `path` es obligatorio).
      return node.filter((el) => !(el && typeof el === 'object' && isBad((el as { path?: unknown }).path))).map(walk);
    }
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([key, v]) => [key, MEDIA_KEYS.includes(key) && isBad(v) ? null : walk(v)]));
    }
    return node;
  };
  return invalid.size ? (walk(value) as T) : value;
}
