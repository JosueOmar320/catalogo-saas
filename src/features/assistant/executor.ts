import { artDirect } from '@/lib/site/art-direction';
import { withBrandGradients } from '@/lib/site/resolve';
import { applySiteTemplate, SITE_TEMPLATES } from '@/lib/site/templates';
import { CONFIRM_ACTIONS, isCatalogAction, type AssistantAction, type CatalogAction, type SectionSpec } from '@/lib/assistant/actions';
import { buildBackgroundSchema, type Background } from '@/lib/design/background';
import { applyPreset, getPreset } from '@/lib/design/presets';
import { themeSchema, type ThemeConfig } from '@/lib/design/theme';
import { PAGE_BLUEPRINT_DEFS } from '@/lib/site/blueprints';
import { navigationSchema, type NavigationItem } from '@/lib/site/navigation';
import { newPage, PAGE_SLUG_PATTERN, RESERVED_PAGE_SLUGS, type SitePage } from '@/lib/site/pages';
import { SECTION_META } from '@/lib/site/section-registry';
import { createSection, SECTION_TYPES, sectionSchemas, type Section, type SectionType } from '@/lib/site/section-schemas';
import { deepMerge, isPlainObject, type PlainObject } from '@/lib/utils/object';
import { slugify } from '@/lib/utils/slug';
import { collectMediaPaths } from '@/lib/utils/storage';
import { builderReducer, type BuilderAction, type BuilderState } from '../builder/reducer';
import { foldText } from '@/lib/utils/text';

/**
 * Ejecutor de Garfield AI: convierte acciones propuestas por el modelo en
 * operaciones del builder. Es una función PURA (estado → plan): la misma
 * ejecución sirve para la vista previa, para aplicar y para las pruebas.
 *
 * - Resuelve referencias ("selected", "last", "$alias", "type:products", slug, título).
 * - Valida el resultado con los schemas estrictos existentes (secciones, tema, fondo, navegación).
 * - Ejecuta con builderReducer: las mismas operaciones que los botones del editor.
 * - La IA no puede inventar archivos: sólo se aceptan rutas de imagen que ya usa el sitio.
 */

export type StepRisk = 'safe' | 'confirm';
export type PlanStep = {
  action: AssistantAction;
  label: string;
  risk: StepRisk;
  status: 'ok' | 'error';
  /** editor = borrador (vista previa, deshacer) · catalog = se guarda en la base al aplicar. */
  kind: 'editor' | 'catalog';
  error?: string;
};

export type AssistantPlan = {
  steps: PlanStep[];
  next: BuilderState;
  /** Hay al menos un cambio aplicable. */
  changed: boolean;
  /** Algún paso válido es destructivo o importante. */
  needsConfirmation: boolean;
  /** Plan chico y seguro: se puede aplicar sin preguntar. */
  autoApply: boolean;
  /** Incluye cambios de productos/categorías (se guardan en la base al aplicar). */
  hasCatalogChanges: boolean;
  /** Página y sección a mostrar después de aplicar. */
  focus: { pageId: string; sectionId: string | null };
  touchedSectionIds: string[];
};

export type ExecutorEnv = {
  lastSectionIds?: string[];
  /** Rutas de la biblioteca validadas por el servidor (buscadas, importadas o adjuntas). */
  allowedMedia?: string[];
  /** Para entender "la categoría Bebidas" o "el Café americano" sin ids. */
  categories?: { id: string; name: string }[];
  items?: { id: string; name: string }[];
};

class StepError extends Error {}
const fail = (message: string): never => {
  throw new StepError(message);
};

const normalize = (value: string) => foldText(value).trim();

const sectionLabel = (section: Section) => {
  const title = (section.content as { title?: string }).title;
  return `${SECTION_META[section.type].label}${title ? ` «${title}»` : section.name ? ` «${section.name}»` : ''}`;
};

/** Primer error de Zod en español legible: "content.presentation.columns.desktop: …". */
function zodMessage(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  if (!issue) return 'Valor inválido';
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

const MEDIA_KEYS = new Set(['path', 'photo', 'imagePath', 'ogImagePath']);

export function planAssistantActions(initial: BuilderState, actions: AssistantAction[], env: ExecutorEnv = {}): AssistantPlan {
  let s = initial;
  const dispatch = (action: BuilderAction) => {
    s = builderReducer(s, action);
  };
  const pageAliases = new Map<string, string>();
  const sectionAliases = new Map<string, string>();
  const touched: string[] = [];
  let focus: AssistantPlan['focus'] = { pageId: initial.selectedPageId, sectionId: initial.selectedSectionId };
  // Rutas de imagen que el sitio ya usa: las únicas que Garfield puede reutilizar.
  const knownMedia = new Set([...collectMediaPaths({ pages: initial.pages, theme: initial.theme }), ...(env.allowedMedia ?? [])]);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const byName = (list: { id: string; name: string }[] | undefined, value: string) => {
    const key = normalize(value);
    return list?.find((x) => x.id === value) ?? list?.find((x) => normalize(x.name) === key) ?? list?.find((x) => normalize(x.name).includes(key));
  };

  /* ---------------- Referencias */

  const currentPage = () => s.pages.find((p) => p.id === s.selectedPageId) ?? s.pages[0];

  function findPage(ref: string | undefined): SitePage {
    if (!ref || ref === 'current' || ref === 'this') return currentPage();
    if (ref.startsWith('$')) {
      const id = pageAliases.get(ref);
      return s.pages.find((p) => p.id === id) ?? fail(`No encuentro la página ${ref} (¿falló el paso que la creaba?).`);
    }
    const key = normalize(ref.replace(/^\//, ''));
    return (
      s.pages.find((p) => p.id === ref) ??
      s.pages.find((p) => p.slug === key) ??
      s.pages.find((p) => normalize(p.title) === key) ??
      (['home', 'inicio', 'principal'].includes(key) ? s.pages.find((p) => p.isHome) : undefined) ??
      s.pages.find((p) => normalize(p.title).includes(key)) ??
      fail(`No encuentro la página "${ref}".`)
    );
  }

  function locate(sectionId: string): { page: SitePage; section: Section } | null {
    for (const page of s.pages) {
      const section = page.sections.find((x) => x.id === sectionId);
      if (section) return { page, section };
    }
    return null;
  }

  function findSection(ref: string, pageRef?: string): { page: SitePage; section: Section } {
    if (ref === 'selected' || ref === 'this' || ref === 'current') {
      return (s.selectedSectionId && locate(s.selectedSectionId)) || fail('No hay una sección seleccionada. Haz clic en una sección de la vista previa o dime cuál.');
    }
    if (ref === 'last' || ref === 'previous') {
      const ids = [...(env.lastSectionIds ?? []), ...touched];
      for (let i = ids.length - 1; i >= 0; i--) {
        const found = locate(ids[i]);
        if (found) return found;
      }
      return fail('No sé cuál es la sección anterior. Dime cuál.');
    }
    if (ref.startsWith('$')) {
      const id = sectionAliases.get(ref);
      return (id && locate(id)) || fail(`No encuentro la sección ${ref}.`);
    }
    const byId = locate(ref);
    if (byId) return byId;
    const page = findPage(pageRef);
    const typeRef = ref.startsWith('type:') ? ref.slice(5) : (SECTION_TYPES as readonly string[]).includes(ref) ? ref : null;
    if (typeRef) {
      const section = page.sections.find((x) => x.type === typeRef && x.visible) ?? page.sections.find((x) => x.type === typeRef);
      return section ? { page, section } : fail(`No hay una sección de tipo ${SECTION_META[typeRef as SectionType]?.label ?? typeRef} en «${page.title}».`);
    }
    const key = normalize(ref);
    const match = (x: Section) => normalize((x.content as { title?: string }).title ?? '') === key || normalize(x.name) === key;
    const section = page.sections.find(match);
    if (section) return { page, section };
    for (const other of s.pages) {
      const found = other.sections.find(match);
      if (found) return { page: other, section: found };
    }
    return fail(`No encuentro la sección "${ref}".`);
  }

  /* ---------------- Saneamiento */

  /** Imágenes desconocidas fuera; enlaces a páginas por referencia → id real. */
  function sanitize(value: unknown, key = ''): unknown {
    if (Array.isArray(value)) {
      // Productos elegidos por nombre → ids.
      if (key === 'itemIds') return value.flatMap((v) => (typeof v === 'string' && (UUID.test(v) || byName(env.items, v)) ? [UUID.test(v) ? v : byName(env.items, v)!.id] : []));
      const list = value.map((v) => sanitize(v));
      // Galerías: una imagen sin ruta válida se descarta.
      return key === 'images' ? list.filter((v) => !isPlainObject(v) || typeof v.path !== 'string' || v.path !== '') : list;
    }
    if (!isPlainObject(value)) {
      if (MEDIA_KEYS.has(key) && typeof value === 'string' && value && !knownMedia.has(value)) return key === 'path' ? '' : null;
      // Categoría por nombre ("Bebidas") → id; un $alias aún no creado (vista previa) → sin filtro.
      if (key === 'categoryId' && typeof value === 'string' && value && !UUID.test(value)) return value.startsWith('$') ? '' : (byName(env.categories, value)?.id ?? '');
      if ((key === 'pageId' || key === 'linkPageId') && typeof value === 'string' && value && !s.pages.some((p) => p.id === value)) {
        try {
          return findPage(value).id;
        } catch {
          return '';
        }
      }
      return value;
    }
    const out: PlainObject = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitize(v, k);
    // image: { path: '' } → null (el schema usa null para "sin imagen").
    if ('path' in out && out.path === '' && key === 'image') out.path = null;
    return out;
  }

  /**
   * Ítems de listas (beneficios, testimonios, preguntas, planes, equipo) y
   * columnas/bloques de la sección Columnas sin id → id nuevo.
   */
  function withItemIds(content: PlainObject): PlainObject {
    const ids = (list: unknown) => (Array.isArray(list) ? list.map((item) => (isPlainObject(item) && !item.id ? { ...item, id: crypto.randomUUID() } : item)) : list);
    const out = { ...content };
    for (const key of ['items', 'plans', 'members'] as const) if (Array.isArray(out[key])) out[key] = ids(out[key]);
    if (Array.isArray(out.columns)) {
      out.columns = (ids(out.columns) as unknown[]).map((column) =>
        isPlainObject(column) && Array.isArray(column.blocks)
          ? { ...column, blocks: (ids(column.blocks) as unknown[]).map((b) => (isPlainObject(b) && Array.isArray(b.items) && b.kind === 'list' ? { ...b, items: ids(b.items) } : b)) }
          : column,
      );
    }
    return out;
  }

  function validSection(candidate: PlainObject): Section {
    const type = candidate.type as SectionType;
    const cleaned = sanitize(candidate) as PlainObject;
    const content = withItemIds(isPlainObject(cleaned.content) ? cleaned.content : {});
    const result = sectionSchemas[type].safeParse({ ...cleaned, content });
    return result.success ? withBrandGradients([result.data as Section], s.theme)[0] : fail(`${SECTION_META[type].label}: ${zodMessage(result.error)}`);
  }

  function buildSection(spec: SectionSpec): Section {
    const content = withItemIds((sanitize(spec.content ?? {}) as PlainObject) ?? {});
    let section: Section;
    try {
      section = createSection(spec.type, content, (sanitize(spec.style ?? {}) as PlainObject) ?? {});
    } catch (error) {
      return fail(`${SECTION_META[spec.type].label}: ${zodMessage(error as { issues: { path: PropertyKey[]; message: string }[] })}`);
    }
    const branded = withBrandGradients([section], s.theme)[0];
    return spec.name ? { ...branded, name: spec.name.slice(0, 60) } : branded;
  }

  /* ---------------- Posición */

  function insertIndex(page: SitePage, position?: { after?: string; before?: string; place?: string }): number {
    if (position?.place === 'start') return 0;
    if (position?.place === 'end') return page.sections.length;
    const anchor = position?.after ?? position?.before;
    if (anchor) {
      const { page: anchorPage, section } = findSection(anchor, page.id);
      if (anchorPage.id !== page.id) fail('Sólo puedo ubicar secciones respecto de otras de la misma página.');
      const index = page.sections.findIndex((x) => x.id === section.id);
      return position?.after ? index + 1 : index;
    }
    const selected = page.sections.findIndex((x) => x.id === s.selectedSectionId);
    return selected >= 0 ? selected + 1 : page.sections.length;
  }

  /* ---------------- Tema y navegación */

  function setTheme(next: unknown) {
    const result = themeSchema.safeParse(sanitize(next));
    if (!result.success) fail(`Tema: ${zodMessage(result.error)}`);
    dispatch({ type: 'setTheme', theme: result.data as ThemeConfig });
  }

  function mergedBackground(current: Background, patch: PlainObject): Background {
    const result = buildBackgroundSchema(false).safeParse(sanitize(deepMerge(current, patch)));
    return result.success ? result.data : fail(`Fondo: ${zodMessage(result.error)}`);
  }

  function findNavItem(ref: string): NavigationItem {
    const items = s.navigation.items;
    if (ref.startsWith('page:')) {
      const page = findPage(ref.slice(5));
      return items.find((i) => i.kind === 'page' && i.pageId === page.id) ?? fail(`«${page.title}» no está en el menú.`);
    }
    const key = normalize(ref);
    return (
      items.find((i) => i.id === ref) ??
      items.find((i) => normalize(i.label) === key) ??
      items.find((i) => i.kind === 'page' && normalize(s.pages.find((p) => p.id === i.pageId)?.title ?? '') === key) ??
      fail(`No encuentro "${ref}" en el menú.`)
    );
  }

  function setNavigation(items: NavigationItem[]) {
    const result = navigationSchema.safeParse({ items });
    if (!result.success) fail(`Menú: ${zodMessage(result.error)}`);
    dispatch({ type: 'setNavigation', navigation: result.data! });
  }

  function setNavVisibility(pageId: string, visible: boolean) {
    const exists = s.navigation.items.some((i) => i.kind === 'page' && i.pageId === pageId);
    if (exists) setNavigation(s.navigation.items.map((i) => (i.kind === 'page' && i.pageId === pageId ? { ...i, visible } : i)));
    else if (visible) setNavigation([...s.navigation.items, { id: crypto.randomUUID(), kind: 'page', pageId, label: '', url: '', visible: true, style: 'link', newTab: false }]);
  }

  const touch = (pageId: string, sectionId: string | null) => {
    if (sectionId) touched.push(sectionId);
    focus = { pageId, sectionId };
  };

  const validSlug = (value: string) => {
    const slug = slugify(value, 60);
    if (!slug || !PAGE_SLUG_PATTERN.test(slug) || RESERVED_PAGE_SLUGS.includes(slug)) fail(`La dirección "${value}" no es válida.`);
    return slug;
  };

  /* ---------------- Acciones */

  function run(a: AssistantAction): { label: string; risk: StepRisk } {
    let risk: StepRisk = CONFIRM_ACTIONS.has(a.action) ? 'confirm' : 'safe';
    switch (a.action) {
      case 'create_page': {
        const blueprint = a.blueprint ? PAGE_BLUEPRINT_DEFS[a.blueprint] : null;
        const catalogPage = s.pages.find((p) => p.sections.some((x) => x.type === 'catalog'));
        const sectionErrors: string[] = [];
        let sections: Section[];
        if (a.sections?.length) {
          sections = a.sections.flatMap((spec) => {
            try {
              const section = buildSection(spec);
              if (spec.as) sectionAliases.set(spec.as, section.id);
              return [section];
            } catch (error) {
              sectionErrors.push((error as Error).message);
              return [];
            }
          });
          if (sections.length === 0) fail(`No pude crear ninguna sección: ${sectionErrors[0]}`);
        } else {
          sections = (blueprint ?? PAGE_BLUEPRINT_DEFS.blank).sections({ topic: a.topic, catalogPageId: catalogPage?.id });
        }
        // Ritmo visual automático (sólo en secciones sin fondo propio).
        sections = artDirect(withBrandGradients(sections, s.theme), s.theme, 'balanced');
        const page = newPage(a.title.slice(0, 80), validSlug(a.slug || a.title), sections, blueprint?.template ?? 'custom');
        dispatch({
          type: 'addPage',
          page: { ...page, isPublished: a.published ?? true, seo: { ...page.seo, ...(a.seo ?? {}) } },
          showInNav: a.showInNav ?? true,
        });
        const created = s.pages[s.pages.length - 1];
        if (a.as) pageAliases.set(a.as, created.id);
        sections.forEach((x) => touched.push(x.id));
        focus = { pageId: created.id, sectionId: null };
        const skipped = sectionErrors.length ? ` · ${sectionErrors.length} sección(es) omitida(s)` : '';
        return { label: `Nueva página «${created.title}» con ${sections.length} secciones${skipped}`, risk };
      }
      case 'update_page': {
        const page = findPage(a.page);
        const patch: Partial<SitePage> = {};
        if (a.title) patch.title = a.title.slice(0, 80);
        if (a.slug) {
          patch.slug = validSlug(a.slug);
          if (patch.slug !== page.slug && s.persistedPageIds.includes(page.id)) risk = 'confirm';
        }
        if (a.published !== undefined) {
          if (!a.published && page.isHome) fail('La página de inicio no se puede ocultar.');
          patch.isPublished = a.published;
        }
        if (a.seo) patch.seo = { ...page.seo, ...a.seo };
        if (Object.keys(patch).length) dispatch({ type: 'updatePage', pageId: page.id, patch });
        if (a.showInNav !== undefined) setNavVisibility(page.id, a.showInNav);
        focus = { pageId: page.id, sectionId: null };
        const parts = [a.title && 'nombre', a.slug && 'dirección', a.published !== undefined && (a.published ? 'publicada' : 'oculta'), a.seo && 'SEO', a.showInNav !== undefined && (a.showInNav ? 'en el menú' : 'fuera del menú')].filter(Boolean);
        return { label: `Página «${page.title}»: ${parts.join(', ') || 'sin cambios'}`, risk };
      }
      case 'duplicate_page': {
        const page = findPage(a.page);
        dispatch({ type: 'duplicatePage', pageId: page.id });
        const copy = currentPage();
        if (a.title) dispatch({ type: 'updatePage', pageId: copy.id, patch: { title: a.title.slice(0, 80) } });
        if (a.as) pageAliases.set(a.as, copy.id);
        focus = { pageId: copy.id, sectionId: null };
        return { label: `Copia de la página «${page.title}»`, risk };
      }
      case 'delete_page': {
        const page = findPage(a.page);
        if (s.pages.length <= 1) fail('No puedo eliminar la única página del sitio.');
        dispatch({ type: 'removePage', pageId: page.id });
        focus = { pageId: s.selectedPageId, sectionId: null };
        return { label: `Eliminar la página «${page.title}»${page.isHome ? ' (la siguiente pasa a ser el inicio)' : ''}`, risk };
      }
      case 'set_home_page': {
        const page = findPage(a.page);
        dispatch({ type: 'setHome', pageId: page.id });
        focus = { pageId: page.id, sectionId: null };
        return { label: `«${page.title}» pasa a ser la página de inicio`, risk };
      }

      case 'create_section': {
        const page = findPage(a.page);
        const section = buildSection(a.section);
        dispatch({ type: 'addSection', section, index: insertIndex(page, a.position), pageId: page.id });
        if (a.section.as) sectionAliases.set(a.section.as, section.id);
        touch(page.id, section.id);
        return { label: `Nueva sección ${sectionLabel(section)} en «${page.title}»`, risk };
      }
      case 'update_section': {
        const { page, section } = findSection(a.section, a.page);
        const candidate = deepMerge(section as unknown as PlainObject, { content: a.content, style: a.style, name: a.name, visible: a.visible });
        const next = validSection(candidate);
        dispatch({ type: 'updateSection', section: next, pageId: page.id });
        touch(page.id, section.id);
        const what = [a.content && 'contenido', a.style && 'estilo', a.visible !== undefined && (a.visible ? 'visible' : 'oculta'), a.name && 'nombre'].filter(Boolean).join(', ');
        return { label: `${sectionLabel(section)}: ${what || 'sin cambios'}`, risk };
      }
      case 'update_product_display': {
        const { page, section } = findSection(a.section, a.page);
        if (section.type !== 'products' && section.type !== 'services' && section.type !== 'catalog') fail(`${sectionLabel(section)} no muestra productos.`);
        if (a.collection && section.type === 'catalog') fail('La sección Catálogo muestra todos los ítems: usa sus filtros en lugar de una colección.');
        const patch: PlainObject = { ...(section.type === 'catalog' ? (a.catalog ?? {}) : {}) };
        if (a.presentation) patch.presentation = a.presentation;
        if (a.collection) patch.collection = a.collection;
        const next = validSection(deepMerge(section as unknown as PlainObject, { content: patch }));
        dispatch({ type: 'updateSection', section: next, pageId: page.id });
        touch(page.id, section.id);
        return { label: `Productos de ${sectionLabel(section)}: ${Object.keys(patch).map((k) => ({ presentation: 'presentación', collection: 'qué mostrar', filters: 'filtros', sort: 'orden', pagination: 'paginación' })[k] ?? k).join(', ')}`, risk };
      }
      case 'move_section': {
        const { page, section } = findSection(a.section, a.page);
        const ids = page.sections.map((x) => x.id).filter((id) => id !== section.id);
        const from = page.sections.findIndex((x) => x.id === section.id);
        let index: number;
        if (a.position.place === 'up') index = Math.max(0, from - 1);
        else if (a.position.place === 'down') index = Math.min(ids.length, from + 1);
        else if (a.position.place === 'start') index = 0;
        else if (a.position.place === 'end') index = ids.length;
        else {
          const anchorRef = a.position.after ?? a.position.before ?? fail('Dime dónde colocarla (arriba o debajo de qué sección).');
          const anchor = findSection(anchorRef, page.id);
          if (anchor.page.id !== page.id) fail('Sólo puedo mover secciones dentro de la misma página.');
          if (anchor.section.id === section.id) fail('La sección de referencia es la misma que quieres mover.');
          const at = ids.indexOf(anchor.section.id);
          index = a.position.after ? at + 1 : at;
        }
        ids.splice(index, 0, section.id);
        dispatch({ type: 'reorderSections', ids, pageId: page.id });
        touch(page.id, section.id);
        return { label: `Mover ${sectionLabel(section)} a la posición ${index + 1} de ${ids.length}`, risk };
      }
      case 'duplicate_section': {
        const { page, section } = findSection(a.section, a.page);
        const before = new Set(page.sections.map((x) => x.id));
        dispatch({ type: 'duplicateSection', sectionId: section.id, pageId: page.id });
        // La copia es la sección nueva de la página (no se asume cuál quedó seleccionada).
        const copy = s.pages.find((p) => p.id === page.id)?.sections.find((x) => !before.has(x.id)) ?? fail(`No se pudo duplicar ${sectionLabel(section)}.`);
        const copyId = copy.id;
        if (a.content) {
          dispatch({ type: 'updateSection', section: validSection(deepMerge(copy as unknown as PlainObject, { content: a.content })), pageId: page.id });
        }
        if (a.as) sectionAliases.set(a.as, copyId);
        touch(page.id, copyId);
        return { label: `Copia de ${sectionLabel(section)}${a.content ? ' con contenido nuevo' : ''}`, risk };
      }
      case 'delete_section': {
        const { page, section } = findSection(a.section, a.page);
        dispatch({ type: 'removeSection', sectionId: section.id, pageId: page.id });
        focus = { pageId: page.id, sectionId: null };
        return { label: `Eliminar ${sectionLabel(section)} de «${page.title}»`, risk };
      }

      case 'update_theme': {
        let theme: ThemeConfig = s.theme;
        if (a.preset) {
          theme = applyPreset(theme, getPreset(a.preset));
          risk = 'confirm';
        }
        const { action: _action, preset: _preset, ...patch } = a;
        setTheme(deepMerge(theme, patch));
        const parts = [a.preset && `tema ${getPreset(a.preset).name}`, ...Object.keys(patch).map((k) => ({ colors: 'colores', typography: 'tipografía', spacing: 'espaciado', shape: 'bordes', buttons: 'botones', header: 'encabezado', footer: 'pie', cards: 'tarjetas', badges: 'etiquetas' })[k] ?? k)].filter(Boolean);
        return { label: `Diseño: ${parts.join(', ')}`, risk };
      }
      case 'update_background': {
        const bg = a.background;
        switch (a.target) {
          case 'site':
            setTheme({ ...s.theme, background: mergedBackground(s.theme.background, bg) });
            return { label: 'Fondo del sitio', risk };
          case 'header':
          case 'footer': {
            const part = s.theme[a.target];
            setTheme({ ...s.theme, [a.target]: { ...part, background: mergedBackground(part.background, bg) } });
            return { label: `Fondo del ${a.target === 'header' ? 'encabezado' : 'pie de página'}`, risk };
          }
          case 'page': {
            const page = findPage(a.page);
            dispatch({ type: 'updatePage', pageId: page.id, patch: { style: { ...page.style, background: mergedBackground(page.style.background, bg) } } });
            focus = { pageId: page.id, sectionId: null };
            return { label: `Fondo de la página «${page.title}»`, risk };
          }
          case 'section': {
            const { page, section } = findSection(a.section ?? 'selected', a.page);
            const next = { ...section, style: { ...section.style, background: mergedBackground(section.style.background, bg) } } as Section;
            dispatch({ type: 'updateSection', section: next, pageId: page.id });
            touch(page.id, section.id);
            return { label: `Fondo de ${sectionLabel(section)}`, risk };
          }
        }
        return fail('Destino de fondo desconocido.');
      }

      case 'add_nav_item': {
        if (a.kind === 'page') {
          const page = findPage(a.page);
          const existing = s.navigation.items.find((i) => i.kind === 'page' && i.pageId === page.id);
          if (existing) setNavigation(s.navigation.items.map((i) => (i.id === existing.id ? { ...i, visible: true, label: a.label ?? i.label, style: a.style ?? i.style } : i)));
          else setNavigation([...s.navigation.items, { id: crypto.randomUUID(), kind: 'page', pageId: page.id, label: a.label ?? '', url: '', visible: true, style: a.style ?? 'link', newTab: false }]);
          return { label: `Menú: enlace a «${page.title}»`, risk };
        }
        if (a.kind === 'url' && !/^https?:\/\//.test(a.url ?? '')) fail('El enlace debe empezar con https://');
        setNavigation([...s.navigation.items, { id: crypto.randomUUID(), kind: a.kind, pageId: '', label: a.label ?? '', url: a.url ?? '', visible: true, style: a.style ?? 'link', newTab: a.kind === 'url' }]);
        return { label: `Menú: nuevo enlace ${a.label ? `«${a.label}»` : a.kind}`, risk };
      }
      case 'update_nav_item': {
        const item = findNavItem(a.item);
        setNavigation(s.navigation.items.map((i) => (i.id === item.id ? { ...i, label: a.label ?? i.label, visible: a.visible ?? i.visible, style: a.style ?? i.style } : i)));
        return { label: `Menú: «${a.label ?? item.label ?? a.item}» ${a.visible === false ? 'oculto' : 'actualizado'}`, risk };
      }
      case 'remove_nav_item': {
        const item = findNavItem(a.item);
        setNavigation(s.navigation.items.filter((i) => i.id !== item.id));
        const label = item.label || s.pages.find((p) => p.id === item.pageId)?.title || item.kind;
        return { label: `Quitar «${label}» del menú`, risk };
      }
      case 'reorder_navigation': {
        const ordered = a.order.map((r) => findNavItem(r));
        const rest = s.navigation.items.filter((i) => !ordered.some((o) => o.id === i.id));
        setNavigation([...ordered, ...rest]);
        return { label: 'Nuevo orden del menú', risk };
      }

      case 'set_image': {
        const { page, section } = findSection(a.section, a.page);
        if (!a.path) fail('No encontré una imagen para eso en tu biblioteca. Súbela en Medios o adjúntala aquí.');
        const path = a.path!;
        if (!knownMedia.has(path)) fail('Esa imagen no está en la biblioteca del negocio.');
        const content = section.content as PlainObject;
        const target = a.target ?? 'auto';
        let patch: PlainObject;
        let where: string;
        if (Array.isArray(content.images) && target !== 'background') {
          patch = { content: { images: [...(content.images as PlainObject[]), { path, caption: a.alt ?? '' }] } };
          where = 'galería';
        } else if (target === 'image' || (target === 'auto' && isPlainObject(content.image) && section.type !== 'hero' && section.type !== 'banner')) {
          if (!isPlainObject(content.image)) fail(`${sectionLabel(section)} no tiene un campo de imagen: usa el fondo.`);
          const extra: PlainObject = {};
          if (section.type === 'text' && content.imagePosition === 'none') extra.imagePosition = 'right';
          if ((section.type === 'hero' || section.type === 'banner') && content.layout !== 'split') extra.layout = 'split';
          patch = { content: { image: { path }, ...extra, ...(a.alt && 'alt' in content ? { alt: a.alt } : {}) } };
          where = 'imagen';
        } else {
          patch = {
            style: {
              background: { type: 'image', image: { path, size: 'cover', position: 'center', opacity: 100 }, overlay: { color: '#000000', opacity: a.overlay ?? 45 } },
              ...((a.overlay ?? 45) >= 30 ? { textColor: 'light' } : {}),
            },
          };
          where = 'fondo';
        }
        dispatch({ type: 'updateSection', section: validSection(deepMerge(section as unknown as PlainObject, patch)), pageId: page.id });
        touch(page.id, section.id);
        return { label: `Imagen en ${sectionLabel(section)} (${where})`, risk };
      }
      case 'add_gallery_images':
      case 'reorder_gallery':
      case 'remove_gallery_images': {
        const { page, section } = findSection(a.section, a.page);
        const images = (section.content as { images?: { path: string; caption: string }[] }).images;
        if (!Array.isArray(images)) fail(`${sectionLabel(section)} no es una galería.`);
        let next: { path: string; caption: string }[];
        if (a.action === 'add_gallery_images') {
          const list = a.images ?? [];
          if (list.length === 0) fail('No encontré imágenes para la galería en tu biblioteca.');
          const unknown = list.find((i) => !knownMedia.has(i.path));
          if (unknown) fail('Una de las imágenes no está en la biblioteca del negocio.');
          const added = list.map((i) => ({ path: i.path, caption: i.caption ?? '' }));
          next = a.replace ? added : [...images!, ...added];
        } else if (a.action === 'reorder_gallery') {
          const ordered = a.order.flatMap((p) => images!.filter((i) => i.path === p));
          next = [...ordered, ...images!.filter((i) => !a.order.includes(i.path))];
        } else {
          next = images!.filter((i) => !a.paths.includes(i.path));
        }
        dispatch({ type: 'updateSection', section: validSection(deepMerge(section as unknown as PlainObject, { content: { images: next } })), pageId: page.id });
        touch(page.id, section.id);
        const verb = { add_gallery_images: a.action === 'add_gallery_images' && a.replace ? 'nuevas imágenes' : 'imágenes agregadas', reorder_gallery: 'nuevo orden', remove_gallery_images: 'imágenes quitadas' }[a.action];
        return { label: `Galería ${sectionLabel(section)}: ${verb} (${next.length})`, risk };
      }

      case 'polish_page': {
        const page = findPage(a.page);
        const sections = artDirect(page.sections, s.theme, a.intensity ?? 'balanced');
        s = { ...s, pages: s.pages.map((p) => (p.id === page.id ? { ...p, sections } : p)), dirty: { ...s.dirty, pages: true } };
        sections.forEach((x) => touched.push(x.id));
        focus = { pageId: page.id, sectionId: null };
        return { label: `Más diseño en «${page.title}» (${{ subtle: 'sutil', balanced: 'equilibrado', bold: 'llamativo' }[a.intensity ?? 'balanced']})`, risk };
      }
      case 'apply_site_template': {
        const result = applySiteTemplate({ theme: s.theme, pages: s.pages, navigation: s.navigation }, a.template, { mode: a.mode, topic: a.topic, keepTheme: a.keepTheme });
        const removed = result.removedPageIds.filter((id) => s.persistedPageIds.includes(id));
        const home = result.pages.find((p) => p.isHome) ?? result.pages[0];
        s = {
          ...s,
          theme: result.theme,
          pages: result.pages,
          navigation: result.navigation,
          deletedPageIds: [...new Set([...s.deletedPageIds, ...removed])],
          selectedPageId: a.mode === 'add' ? s.selectedPageId : home.id,
          selectedSectionId: null,
          dirty: { theme: !a.keepTheme || s.dirty.theme, navigation: true, pages: true },
        };
        result.pages.flatMap((p) => p.sections).forEach((x) => touched.push(x.id));
        focus = { pageId: s.selectedPageId, sectionId: null };
        const label = SITE_TEMPLATES[a.template].label;
        return { label: a.mode === 'add' ? `Agregar las páginas de la plantilla «${label}»` : `Sitio desde la plantilla «${label}» (${result.pages.length} páginas)`, risk };
      }
      case 'focus': {
        if (a.section) {
          const { page, section } = findSection(a.section, a.page);
          focus = { pageId: page.id, sectionId: section.id };
          return { label: `Abrir ${sectionLabel(section)}`, risk };
        }
        const page = findPage(a.page);
        focus = { pageId: page.id, sectionId: null };
        return { label: `Abrir «${page.title}»`, risk };
      }
      default:
        // Productos y categorías no pasan por el borrador (ver isCatalogAction).
        return fail('Esta acción se aplica en el servidor.');
    }
  }

  const steps: PlanStep[] = actions.map((action) => {
    // Productos y categorías: se validan y ejecutan en el servidor al aplicar.
    if (isCatalogAction(action)) return { action, label: describeCatalog(action), risk: CONFIRM_ACTIONS.has(action.action) ? 'confirm' : 'safe', status: 'ok', kind: 'catalog' };
    const before = s;
    try {
      const { label, risk } = run(action);
      return { action, label, risk, status: 'ok', kind: 'editor' };
    } catch (error) {
      s = before; // un paso fallido no deja cambios a medias
      if (!(error instanceof StepError) && !(error instanceof Error)) throw error;
      return { action, label: describeFailed(action), risk: CONFIRM_ACTIONS.has(action.action) ? 'confirm' : 'safe', status: 'error', kind: 'editor', error: error.message };
    }
  });

  // Deja el editor mostrando el resultado.
  if (s.pages.some((p) => p.id === focus.pageId)) {
    s = { ...s, selectedPageId: focus.pageId, selectedSectionId: focus.sectionId, editingPageSettings: false, ...(focus.sectionId ? { panel: 'pages' as const } : {}) };
  }

  const ok = steps.filter((x) => x.status === 'ok');
  const hasCatalogChanges = ok.some((x) => x.kind === 'catalog');
  const changed = ok.some((x) => x.action.action !== 'focus');
  const needsConfirmation = ok.some((x) => x.risk === 'confirm') || ok.length > 6;
  // Guardar productos o categorías siempre lo confirma el usuario (no es un borrador).
  const autoApply = ok.length > 0 && !needsConfirmation && !hasCatalogChanges && ok.length <= 2 && !ok.some((x) => x.action.action === 'create_page');
  return { steps, next: s, changed, needsConfirmation, autoApply, hasCatalogChanges, focus, touchedSectionIds: [...new Set(touched)] };
}

function describeCatalog(a: CatalogAction): string {
  switch (a.action) {
    case 'set_logo':
      return 'Usar la imagen como logo del negocio';
    case 'create_category':
      return `Nueva categoría «${a.name}»`;
    case 'update_category':
      return `Categoría «${a.category}»: ${[a.name && 'nombre', a.description !== undefined && 'descripción', a.imagePath !== undefined && 'imagen', a.active !== undefined && (a.active ? 'activa' : 'oculta')].filter(Boolean).join(', ') || 'cambios'}`;
    case 'delete_category':
      return `Eliminar la categoría «${a.category}» (sus ítems quedan sin categoría)`;
    case 'reorder_categories':
      return 'Nuevo orden de categorías';
    case 'create_product':
      return `Nuevo ${a.type === 'service' ? 'servicio' : 'producto'} «${a.name}»${a.price != null ? ` · ${a.price}` : ''}`;
    case 'update_product':
      return `«${a.product}»: ${Object.keys(a).filter((k) => k !== 'action' && k !== 'product').map((k) => ({ price: 'precio', compareAtPrice: 'precio anterior', shortDescription: 'descripción corta', description: 'descripción', imagePaths: 'imágenes', featured: 'destacado', available: 'disponibilidad', visible: 'visibilidad', category: 'categoría', name: 'nombre' })[k] ?? k).join(', ')}`;
    case 'delete_product':
      return `Eliminar «${a.product}»`;
    case 'reorder_products':
      return 'Nuevo orden de productos';
  }
}

function describeFailed(action: AssistantAction): string {
  switch (action.action) {
    case 'create_section':
      return `Nueva sección ${SECTION_META[action.section.type].label}`;
    case 'create_page':
      return `Nueva página «${action.title}»`;
    case 'set_image':
      return 'Poner una imagen en la sección';
    case 'add_gallery_images':
      return 'Agregar imágenes a la galería';
    case 'set_logo':
      return 'Usar el logo del negocio';
    default:
      return action.action.replace(/_/g, ' ');
  }
}
