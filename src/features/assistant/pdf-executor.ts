import { PDF_CONFIRM_ACTIONS, type PdfAction } from '@/lib/assistant/pdf-actions';
import { presentation, PRODUCT_LAYOUT_META } from '@/lib/catalog/presentation';
import { createPdfBlock, PDF_BLOCK_META, PDF_TEMPLATE_META, pdfSettingsSchema, applyTemplate, parsePdfSettings, type PdfBlock, type PdfBlockType, type PdfSettings } from '@/lib/pdf/settings';
import { deepMerge } from '@/lib/utils/object';
import { collectMediaPaths } from '@/lib/utils/storage';
import { foldText } from '@/lib/utils/text';
import { interpolate, type Translator } from '@/i18n/translate';

/**
 * Ejecutor PURO de las acciones de Garfield en el estudio de PDF: recibe la
 * configuración actual y devuelve la siguiente (para vista previa, aplicar
 * o deshacer). Cada paso se valida con el schema estricto; un paso inválido
 * no deja cambios a medias.
 */

export type PdfPlanStep = { action: PdfAction; label: string; status: 'ok' | 'error'; risk: 'safe' | 'confirm'; error?: string; kind: 'pdf' };
export type PdfPlan = {
  next: PdfSettings;
  steps: PdfPlanStep[];
  changed: boolean;
  needsConfirmation: boolean;
  autoApply: boolean;
  focusBlockId: string | null;
  touchedBlockIds: string[];
};
export type PdfExecutorEnv = {
  selectedBlockId?: string | null;
  allowedMedia?: string[];
  /** Traductor de la app para las etiquetas y errores de los pasos (por defecto, español). */
  t?: Translator;
};

class StepError extends Error {}
const fail = (message: string): never => {
  throw new StepError(message);
};
const norm = (v: string) => foldText(v).trim();
const PRODUCT_BLOCKS = new Set<PdfBlockType>(['catalog', 'products']);
type Obj = Record<string, unknown>;

const blockTitle = (b: PdfBlock) => ('title' in b && typeof b.title === 'string' && b.title ? b.title : PDF_BLOCK_META[b.type].label);

export function planPdfActions(settings: PdfSettings, actions: PdfAction[], env: PdfExecutorEnv = {}): PdfPlan {
  let s: PdfSettings = structuredClone(settings);
  const t = env.t ?? interpolate;
  const blockName = (type: PdfBlockType) => t(PDF_BLOCK_META[type].label);
  const aliases = new Map<string, string>();
  const touched: string[] = [];
  const known = new Set([...(env.allowedMedia ?? []), ...collectMediaPaths(settings)]);
  let focusBlockId: string | null = null;

  function findBlocks(ref: string, allowMany = false): PdfBlock[] {
    const r = ref.trim();
    if (r === 'selected' || r === 'this' || r === 'current') {
      const b = s.blocks.find((x) => x.id === env.selectedBlockId);
      return b ? [b] : fail(t('No hay un bloque seleccionado. Elígelo en la lista o dime cuál.'));
    }
    if (r === 'last') {
      const id = touched[touched.length - 1];
      const b = s.blocks.find((x) => x.id === id);
      return b ? [b] : fail(t('No sé cuál es el bloque anterior.'));
    }
    if (r === 'all-products') {
      const list = s.blocks.filter((b) => PRODUCT_BLOCKS.has(b.type));
      return list.length ? (allowMany ? list : [list[0]]) : fail(t('El PDF no tiene bloques de productos. Agrega un catálogo o una colección.'));
    }
    if (r.startsWith('$')) {
      const b = s.blocks.find((x) => x.id === aliases.get(r));
      return b ? [b] : fail(t('No encuentro el bloque {ref}.', { ref: r }));
    }
    if (r.startsWith('type:')) {
      const type = r.slice(5);
      const list = s.blocks.filter((b) => b.type === type);
      return list.length ? (allowMany ? list : [list[0]]) : fail(t('El PDF no tiene un bloque «{block}».', { block: PDF_BLOCK_META[type as PdfBlockType] ? blockName(type as PdfBlockType) : type }));
    }
    const index = r.match(/^#(\d+)$/);
    if (index) {
      const b = s.blocks[Number(index[1]) - 1];
      return b ? [b] : fail(t('No hay un bloque número {number}.', { number: index[1] }));
    }
    const byId = s.blocks.find((b) => b.id === r);
    if (byId) return [byId];
    const key = norm(r);
    const byTitle = s.blocks.find((b) => norm(blockTitle(b)) === key) ?? s.blocks.find((b) => norm(blockTitle(b)).includes(key) || norm(PDF_BLOCK_META[b.type].label).includes(key));
    return byTitle ? [byTitle] : fail(t('No encuentro el bloque «{ref}».', { ref }));
  }
  const findBlock = (ref: string) => findBlocks(ref)[0];

  function insertAt(block: PdfBlock, position?: { after?: string; before?: string; place?: 'start' | 'end' | 'up' | 'down' }) {
    const list = s.blocks.filter((b) => b.id !== block.id);
    let index: number;
    if (position?.after) index = list.findIndex((b) => b.id === findBlock(position.after!).id) + 1;
    else if (position?.before) index = list.findIndex((b) => b.id === findBlock(position.before!).id);
    else if (position?.place === 'start') index = list[0]?.type === 'cover' && block.type !== 'cover' ? 1 : 0;
    else if (position?.place === 'up' || position?.place === 'down') {
      const current = s.blocks.findIndex((b) => b.id === block.id);
      index = Math.max(0, Math.min(list.length, current + (position.place === 'up' ? -1 : 1)));
    } else {
      // Al final, pero antes de la contraportada (que siempre cierra).
      const back = list.findIndex((b) => b.type === 'backCover');
      index = block.type === 'backCover' || back === -1 ? list.length : back;
    }
    list.splice(Math.max(0, index), 0, block);
    s = { ...s, blocks: list };
  }

  /** Re-normaliza un bloque con el schema (valores por defecto, enums). */
  function normalizeBlock(block: Obj): PdfBlock {
    const parsed = parsePdfSettings({ version: 2, blocks: [block] }).blocks[0];
    return parsed && parsed.type === block.type ? parsed : fail(t('Ese cambio no es válido para el bloque.'));
  }
  const replaceBlock = (block: PdfBlock) => {
    s = { ...s, blocks: s.blocks.map((b) => (b.id === block.id ? block : b)) };
    touched.push(block.id);
  };

  function run(a: PdfAction): string {
    switch (a.action) {
      case 'set_pdf_template':
        s = applyTemplate(s, a.template);
        return t('Plantilla «{template}»', { template: t(PDF_TEMPLATE_META[a.template].label) });
      case 'update_pdf_settings': {
        const { action: _a, background, decorations, ...rest } = a;
        s = { ...s, ...rest, ...(background ? { background: deepMerge(s.background as unknown as Obj, background) as unknown as PdfSettings['background'] } : {}), ...(decorations ? { decorations: { ...s.decorations, ...decorations } as PdfSettings['decorations'] } : {}) };
        const parts = [a.paperSize && t('papel {size}', { size: a.paperSize }), a.orientation && (a.orientation === 'landscape' ? t('horizontal') : t('vertical')), a.margins && t('márgenes {margins}', { margins: a.margins }), background && t('fondo'), decorations && t('decoración'), a.inkSaver !== undefined && t('ahorro de tinta')].filter(Boolean);
        return t('Formato: {changes}', { changes: parts.join(', ') || t('cambios') });
      }
      case 'update_pdf_style': {
        const { action: _a, ...style } = a;
        s = { ...s, style: { ...s.style, ...style } };
        return t('Estilo del PDF (tipografía, colores, densidad)');
      }
      case 'update_pdf_cover': {
        const { action: _a, media: _m, background, imagePath, ...rest } = a;
        const image = imagePath === undefined ? {} : imagePath === null ? { imageSource: 'none' as const, imagePath: null } : { imageSource: 'custom' as const, imagePath };
        s = { ...s, cover: { ...s.cover, ...rest, ...image, ...(background ? { background: deepMerge(s.cover.background as unknown as Obj, background) as unknown as PdfSettings['cover']['background'] } : {}) } };
        return t('Portada');
      }
      case 'update_pdf_header': {
        const { action: _a, ...header } = a;
        s = { ...s, header: { ...s.header, ...header } };
        if (!a.showLogo) return t('Encabezado');
        return a.align === 'right' ? t('Encabezado con logo a la derecha') : a.align === 'center' ? t('Encabezado con logo al centro') : t('Encabezado con logo a la izquierda');
      }
      case 'update_pdf_footer': {
        const { action: _a, ...footer } = a;
        s = { ...s, footer: { ...s.footer, ...footer } };
        return a.pageNumbers && a.pageNumbers !== 'none' ? t('Pie de página con número de página') : t('Pie de página');
      }
      case 'add_pdf_block': {
        const type = a.type as PdfBlockType;
        if (type === 'cover' && s.blocks.some((b) => b.type === 'cover')) fail(t('El PDF ya tiene portada.'));
        const block = normalizeBlock({ ...createPdfBlock(type, s.template), ...(a.fields ?? {}), type });
        insertAt(block, a.position);
        if (a.as) aliases.set(a.as, block.id);
        touched.push(block.id);
        return 'title' in block && block.title ? t('Nueva página: {block} «{title}»', { block: blockName(type), title: block.title }) : t('Nueva página: {block}', { block: blockName(type) });
      }
      case 'update_pdf_block': {
        const current = findBlock(a.block);
        const { id: _id, type: _type, ...fields } = a.fields as Obj;
        const next = normalizeBlock(deepMerge(current as unknown as Obj, fields) as Obj);
        replaceBlock({ ...next, id: current.id } as PdfBlock);
        return t('{block}: cambios', { block: blockName(current.type) });
      }
      case 'remove_pdf_block': {
        const block = findBlock(a.block);
        s = { ...s, blocks: s.blocks.filter((b) => b.id !== block.id) };
        return 'title' in block && block.title ? t('Quitar {block} «{title}»', { block: blockName(block.type), title: block.title }) : t('Quitar {block}', { block: blockName(block.type) });
      }
      case 'move_pdf_block': {
        const block = findBlock(a.block);
        insertAt(block, a.position);
        touched.push(block.id);
        return t('Mover {block}', { block: blockName(block.type) });
      }
      case 'duplicate_pdf_block': {
        const block = findBlock(a.block);
        const copy = { ...structuredClone(block), id: `${block.type}-${Math.random().toString(36).slice(2, 9)}` } as PdfBlock;
        insertAt(copy, { after: block.id });
        if (a.as) aliases.set(a.as, copy.id);
        touched.push(copy.id);
        return t('Duplicar {block}', { block: blockName(block.type) });
      }
      case 'set_pdf_products_layout': {
        const targets = findBlocks(a.block ?? 'all-products', true).filter((b) => PRODUCT_BLOCKS.has(b.type));
        if (!targets.length) fail(t('Ese bloque no muestra productos.'));
        for (const block of targets) {
          if (block.type !== 'catalog' && block.type !== 'products') continue;
          const p = block.presentation;
          const nextPresentation = presentation({
            ...p,
            ...(a.layout ? { layout: a.layout } : {}),
            ...(a.shape ? { shape: a.shape } : {}),
            columns: { ...p.columns, ...(a.columns ? { pdf: a.columns } : {}) },
            fields: { ...p.fields, ...(a.fields ?? {}) },
          });
          const extra = block.type === 'catalog' ? { ...(a.categoryStyle ? { categoryStyle: a.categoryStyle } : {}), ...(a.categoryNewPage !== undefined ? { categoryNewPage: a.categoryNewPage } : {}) } : {};
          replaceBlock({ ...block, presentation: nextPresentation, ...(a.itemsPerPage !== undefined ? { itemsPerPage: a.itemsPerPage } : {}), ...extra } as PdfBlock);
        }
        const parts = [
          a.layout && t(PRODUCT_LAYOUT_META[a.layout].label),
          a.columns && t('{count} columnas', { count: a.columns }),
          a.itemsPerPage !== undefined && (a.itemsPerPage ? t('{count} por página', { count: a.itemsPerPage }) : t('los que quepan por página')),
          a.categoryStyle && t('portada de categoría'),
          a.categoryNewPage && t('categoría en página nueva'),
          a.fields && t('campos'),
        ].filter(Boolean);
        return t('Productos del PDF: {changes}', { changes: parts.join(', ') || t('cambios') });
      }
      case 'focus_pdf_block': {
        const block = findBlock(a.block);
        focusBlockId = block.id;
        return t('Abrir {block}', { block: blockName(block.type) });
      }
    }
  }

  const steps: PdfPlanStep[] = actions.map((action) => {
    const before = s;
    const risk = PDF_CONFIRM_ACTIONS.has(action.action) ? 'confirm' : 'safe';
    try {
      const label = run(action);
      // Imágenes nuevas: sólo de la biblioteca (validadas por el servidor).
      const unknown = collectMediaPaths(s).find((path) => !known.has(path));
      if (unknown) fail(t('Una de las imágenes no está en la biblioteca del negocio.'));
      const check = pdfSettingsSchema.safeParse(s);
      if (!check.success) fail(t('Valor inválido ({field}).', { field: check.error.issues[0]?.path.join('.') || t('configuración') }));
      s = check.data!;
      return { action, label, risk, status: 'ok', kind: 'pdf' };
    } catch (error) {
      s = before;
      if (!(error instanceof Error)) throw error;
      return { action, label: action.action.replace(/_/g, ' '), risk, status: 'error', kind: 'pdf', error: error.message };
    }
  });

  const okSteps = steps.filter((st) => st.status === 'ok');
  const changed = JSON.stringify(s) !== JSON.stringify(settings);
  const needsConfirmation = okSteps.some((st) => st.risk === 'confirm');
  return { next: s, steps, changed, needsConfirmation, autoApply: changed && !needsConfirmation, focusBlockId, touchedBlockIds: touched };
}
