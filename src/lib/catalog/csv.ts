import { msg } from '@/i18n/translate';

/**
 * Importar y exportar productos y servicios en CSV (abre en Excel, Numbers y
 * Google Sheets). Puro: lo usan la vista previa del navegador y la acción del
 * servidor, que vuelve a validar todo.
 */

/* ------------------------------------------------------------------ CSV */

/** Separa un CSV (RFC 4180): comillas, comillas dobles escapadas y saltos de línea dentro de celdas. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  // Excel en español (y otros) usa ";" cuando la coma es el separador decimal.
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== '')).map((r) => r.map(unescapeFormula));
}

/**
 * Una celda que empieza con =, +, -, @ o tabulador la hoja de cálculo la
 * ejecutaría como fórmula (=HYPERLINK, =cmd|…): se antepone un apóstrofo, como
 * hace Excel para "texto literal". También a teléfonos "+52 …" (inofensivo: al
 * reimportar, parseCsv lo quita).
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const escapeCell = (raw: string) => {
  const formula = FORMULA_START.test(raw);
  const value = formula ? `'${raw}` : raw;
  return formula || /[",;\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

/** Quita el apóstrofo que escapeCell antepone a una fórmula (y el que pone Excel al exportar texto así). */
const unescapeFormula = (cell: string) => (cell.length > 1 && cell[0] === "'" && FORMULA_START.test(cell.slice(1)) ? cell.slice(1) : cell);

/** CSV con BOM (Excel reconoce los acentos) y CRLF. */
export function toCsv(rows: string[][]): string {
  return `﻿${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------- Columnas */

export const ITEM_COLUMNS = [
  { key: 'name', header: 'nombre', aliases: ['name', 'producto', 'nombre del producto'] },
  { key: 'type', header: 'tipo', aliases: ['type'] },
  { key: 'category', header: 'categoria', aliases: ['categoría', 'category'] },
  { key: 'price', header: 'precio', aliases: ['price'] },
  { key: 'compareAt', header: 'precio_anterior', aliases: ['precio anterior', 'compare_at_price', 'compare at price', 'precio antes'] },
  { key: 'priceNote', header: 'nota_precio', aliases: ['nota de precio', 'price_note', 'price note'] },
  { key: 'sku', header: 'codigo', aliases: ['código', 'sku', 'code'] },
  { key: 'shortDescription', header: 'descripcion_corta', aliases: ['descripción corta', 'short_description', 'short description', 'resumen'] },
  { key: 'description', header: 'descripcion', aliases: ['descripción', 'description'] },
  { key: 'available', header: 'disponible', aliases: ['available', 'en existencia'] },
  { key: 'visible', header: 'visible', aliases: ['mostrar', 'publicado'] },
  { key: 'featured', header: 'destacado', aliases: ['featured'] },
  { key: 'tags', header: 'etiquetas', aliases: ['tags'] },
  { key: 'images', header: 'imagenes', aliases: ['imágenes', 'imagen', 'images', 'image', 'image_url', 'fotos', 'foto', 'photos'] },
] as const;

export type ItemColumn = (typeof ITEM_COLUMNS)[number]['key'];

const normalizeHeader = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, '_');
const HEADER_LOOKUP = new Map<string, ItemColumn>(ITEM_COLUMNS.flatMap((c) => [c.header, ...c.aliases].map((alias) => [normalizeHeader(alias), c.key] as const)));

/* --------------------------------------------------------------- Valores */

const TRUE = new Set(['si', 'sí', 'yes', 'y', 'true', '1', 'x', 'verdadero']);
const FALSE = new Set(['no', 'n', 'false', '0', 'falso']);

export function parseBoolean(value: string, fallback: boolean): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === '') return fallback;
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return false;
  return null;
}

/**
 * "1,200.50", "1.200,50", "$ 48", "48,5" → número. El último separador con 1–2
 * decimales es el decimal; los demás son de miles. Vacío → null; inválido → NaN.
 */
export function parsePriceCell(value: string): number | null {
  const raw = value.replace(/[^\d.,-]/g, '');
  if (raw === '') return value.trim() === '' ? null : Number.NaN;
  const lastSep = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  let normalized = raw;
  if (lastSep >= 0) {
    const decimals = raw.length - lastSep - 1;
    const intPart = raw.slice(0, lastSep).replace(/[.,]/g, '');
    normalized = decimals > 0 && decimals <= 2 ? `${intPart}.${raw.slice(lastSep + 1)}` : raw.replace(/[.,]/g, '');
  }
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : Number.NaN;
}

/* --------------------------------------------------------------- Filas */

export type ImportRow = {
  /** Línea del archivo (para los mensajes). */
  line: number;
  name: string;
  type: 'product' | 'service';
  category: string | null;
  price: number | null;
  compareAt: number | null;
  priceNote: string | null;
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  available: boolean;
  visible: boolean;
  featured: boolean;
  tags: string[];
  /** Enlaces de fotos (http/https): se descargan después de importar, sólo si el ítem no tiene fotos. */
  images: string[];
};

export type ImportIssue = { line: number; message: string; params?: Record<string, string | number> };

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_IMAGES = 5;

/** "url1 | url2" o separadas por espacios o saltos de línea → enlaces; null si alguno no es http(s). */
export function parseImageCell(value: string): string[] | null {
  const urls = value.split(/[\s|]+/).filter(Boolean);
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || url.length > 1000) return null;
    } catch {
      return null;
    }
  }
  return [...new Set(urls)].slice(0, MAX_IMPORT_IMAGES);
}

const TYPES: Record<string, 'product' | 'service'> = { producto: 'product', product: 'product', servicio: 'service', service: 'service', '': 'product' };

const LIMITS = { name: 160, category: 80, priceNote: 40, sku: 64, shortDescription: 300, description: 5000 } as const;

/**
 * Convierte la tabla del CSV en filas válidas + errores por línea. La primera
 * fila son los encabezados (se aceptan en español o inglés, con o sin acentos).
 */
export function parseItemTable(table: string[][], defaultType: 'product' | 'service' = 'product'): { rows: ImportRow[]; issues: ImportIssue[]; columns: ItemColumn[] } {
  const [header = [], ...body] = table;
  const columns = header.map((h) => HEADER_LOOKUP.get(normalizeHeader(h)) ?? null);
  const found = columns.filter((c): c is ItemColumn => c !== null);
  const issues: ImportIssue[] = [];
  if (!found.includes('name')) return { rows: [], issues: [{ line: 1, message: msg('Falta la columna "nombre".') }], columns: found };
  if (body.length > MAX_IMPORT_ROWS) issues.push({ line: 1, message: msg('Se importan hasta {max} filas por archivo; el resto se ignora.'), params: { max: MAX_IMPORT_ROWS } });

  const rows: ImportRow[] = [];
  for (const [index, cells] of body.slice(0, MAX_IMPORT_ROWS).entries()) {
    const line = index + 2;
    const get = (key: ItemColumn) => {
      const at = columns.indexOf(key);
      return at >= 0 ? (cells[at] ?? '').trim() : '';
    };
    const name = get('name');
    if (!name) {
      issues.push({ line, message: msg('Falta el nombre.') });
      continue;
    }
    const typeCell = get('type').toLowerCase();
    const type = typeCell === '' ? defaultType : TYPES[typeCell];
    const price = parsePriceCell(get('price'));
    const compareAt = parsePriceCell(get('compareAt'));
    const available = parseBoolean(get('available'), true);
    const visible = parseBoolean(get('visible'), true);
    const featured = parseBoolean(get('featured'), false);
    const images = parseImageCell(get('images'));

    const problem =
      (!type && msg('Tipo inválido: usa "producto" o "servicio".')) ||
      (Number.isNaN(price) && msg('Precio inválido.')) ||
      (Number.isNaN(compareAt) && msg('Precio anterior inválido.')) ||
      (compareAt !== null && (price === null || compareAt <= price) && msg('El precio anterior debe ser mayor que el precio.')) ||
      ((available === null || visible === null || featured === null) && msg('Usa "sí" o "no" en disponible, visible y destacado.')) ||
      (name.length > LIMITS.name && msg('El nombre es muy largo.')) ||
      (get('category').length > LIMITS.category && msg('El nombre de la categoría es muy largo.')) ||
      (get('sku').length > LIMITS.sku && msg('El código es muy largo.')) ||
      (get('priceNote').length > LIMITS.priceNote && msg('La nota de precio es muy larga.')) ||
      (get('shortDescription').length > LIMITS.shortDescription && msg('La descripción corta es muy larga.')) ||
      (get('description').length > LIMITS.description && msg('La descripción es muy larga.')) ||
      (images === null && msg('Las imágenes deben ser enlaces que empiecen con http:// o https://.'));
    if (problem) {
      issues.push({ line, message: problem });
      continue;
    }
    rows.push({
      line,
      name,
      type: type!,
      category: get('category') || null,
      price: price as number | null,
      compareAt: compareAt as number | null,
      priceNote: get('priceNote') || null,
      sku: get('sku') || null,
      shortDescription: get('shortDescription') || null,
      description: get('description') || null,
      available: available!,
      visible: visible!,
      featured: featured!,
      tags: get('tags')
        .split(/[|;,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 15)
        .map((tag) => tag.slice(0, 30)),
      images: images!,
    });
  }
  return { rows, issues, columns: found };
}

/**
 * Clave para reconocer un ítem existente: el código si hay, si no el nombre
 * (sin mayúsculas ni acentos) y el tipo. Con `bySku` en false (el archivo no
 * trae la columna de código) siempre va por nombre y tipo, aunque el ítem
 * guardado tenga código: así no se duplica.
 */
export function matchKey(item: { sku?: string | null; name: string; type: string }, bySku = true): string {
  return bySku && item.sku ? `sku:${item.sku.trim().toLowerCase()}` : `name:${item.type}:${normalizeHeader(item.name)}`;
}

/* ------------------------------------------------------- Actualización */

/** Columnas de catalog_items que puede tocar una fila importada. */
export type ImportItemPatch = Partial<{
  name: string;
  type: 'product' | 'service';
  category_id: string | null;
  price: number | null;
  compare_at_price: number | null;
  price_note: string | null;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  is_available: boolean;
  is_visible: boolean;
  is_featured: boolean;
  tags: string[];
}>;

/**
 * Qué cambia una fila en un ítem que YA existe: sólo las columnas que vienen
 * en el archivo; las demás (código, descripciones, visible, etiquetas…) quedan
 * como están. `existing` trae el precio y precio anterior guardados, para que
 * el precio anterior siga siendo válido (mayor que el precio) al combinar lo
 * del archivo con lo guardado. Puro.
 */
export function importUpdatePatch(
  row: Omit<ImportRow, 'line' | 'images'>,
  columns: readonly ItemColumn[],
  existing: { price: number | null; compareAt: number | null },
  categoryId: string | null,
): ImportItemPatch {
  const has = (column: ItemColumn) => columns.includes(column);
  const patch: ImportItemPatch = {};
  if (has('name')) patch.name = row.name;
  if (has('type')) patch.type = row.type;
  if (has('category')) patch.category_id = categoryId;
  if (has('price') || has('compareAt')) {
    const price = has('price') ? row.price : existing.price;
    const compareAt = has('compareAt') ? row.compareAt : existing.compareAt;
    if (has('price')) patch.price = price;
    patch.compare_at_price = compareAt !== null && price !== null && compareAt > price ? compareAt : null;
  }
  if (has('priceNote')) patch.price_note = row.priceNote;
  if (has('sku')) patch.sku = row.sku;
  if (has('shortDescription')) patch.short_description = row.shortDescription;
  if (has('description')) patch.description = row.description;
  if (has('available')) patch.is_available = row.available;
  if (has('visible')) patch.is_visible = row.visible;
  if (has('featured')) patch.is_featured = row.featured;
  if (has('tags')) patch.tags = row.tags;
  return patch;
}

/* ------------------------------------------------------------- Exportar */

export type ExportItem = {
  name: string;
  type: 'product' | 'service';
  categoryName: string | null;
  price: number | null;
  compareAt: number | null;
  priceNote: string | null;
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  available: boolean;
  visible: boolean;
  featured: boolean;
  tags: string[];
  /** Enlaces públicos de las fotos (al volver a importar se descargan sólo si el ítem no tiene). */
  images?: string[];
};

const yesNo = (value: boolean) => (value ? 'sí' : 'no');
const number = (value: number | null) => (value === null ? '' : String(value));

/** Los encabezados van en español (el importador también acepta inglés). */
export function itemsToCsv(items: ExportItem[]): string {
  return toCsv([
    ITEM_COLUMNS.map((c) => c.header),
    ...items.map((i) => [
      i.name,
      i.type === 'service' ? 'servicio' : 'producto',
      i.categoryName ?? '',
      number(i.price),
      number(i.compareAt),
      i.priceNote ?? '',
      i.sku ?? '',
      i.shortDescription ?? '',
      i.description ?? '',
      yesNo(i.available),
      yesNo(i.visible),
      yesNo(i.featured),
      i.tags.join(' | '),
      (i.images ?? []).join(' | '),
    ]),
  ]);
}

export const CSV_TEMPLATE_ROWS: ExportItem[] = [
  { name: 'Café americano', type: 'product', categoryName: 'Bebidas', price: 35, compareAt: null, priceNote: null, sku: 'CAF-001', shortDescription: 'Taza de 12 oz', description: null, available: true, visible: true, featured: false, tags: ['caliente'] },
  { name: 'Pastel de chocolate', type: 'product', categoryName: 'Postres', price: 65, compareAt: 80, priceNote: 'rebanada', sku: 'POS-002', shortDescription: null, description: null, available: true, visible: true, featured: true, tags: [] },
];
