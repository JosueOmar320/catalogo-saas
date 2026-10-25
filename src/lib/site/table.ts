import { TABLE_MAX_COLUMNS, TABLE_MAX_ROWS, type SectionOf } from './section-schemas';

/**
 * Sección Tabla: pegar desde Excel / Google Sheets y mantener las celdas de
 * cada fila alineadas con sus columnas al agregar o quitar una. Puro.
 */
type Table = Pick<SectionOf<'table'>['content'], 'columns' | 'rows'>;
type Align = Table['columns'][number]['align'];

const id = () => crypto.randomUUID();

/** Una línea de CSV respetando comillas ("a, b" queda en una celda). */
function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === separator) {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** Números, precios y porcentajes se alinean a la derecha. */
const looksNumeric = (values: string[]) => values.length > 0 && values.every((v) => !v.trim() || /^[\s$€£¥+-]*[\d.,]+\s*(%|mxn|usd|eur)?\s*$/i.test(v));

/**
 * Texto copiado de una hoja de cálculo (tabuladores) o CSV (comas / punto y
 * coma) → columnas y filas. Con `header`, la primera línea son los títulos.
 */
export function parseTablePaste(text: string, { header = true }: { header?: boolean } = {}): Table | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim());
  if (lines.length === 0) return null;
  const separator = lines[0].includes('\t') ? '\t' : (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const matrix = lines.slice(0, TABLE_MAX_ROWS + 1).map((line) => splitCsvLine(line, separator).map((cell) => cell.trim().slice(0, 300)));
  const width = Math.min(TABLE_MAX_COLUMNS, Math.max(...matrix.map((row) => row.length)));
  const head = header ? matrix[0] : [];
  const body = (header ? matrix.slice(1) : matrix).slice(0, TABLE_MAX_ROWS);
  const columns = Array.from({ length: width }, (_, i) => ({
    id: id(),
    label: (head[i] ?? '').slice(0, 80),
    align: (i > 0 && looksNumeric(body.map((row) => row[i] ?? '')) ? 'right' : 'left') as Align,
  }));
  return { columns, rows: body.map((row) => ({ id: id(), cells: Array.from({ length: width }, (_, i) => row[i] ?? '') })) };
}

/** Agrega una columna al final (con su celda vacía en cada fila). */
export function addTableColumn(table: Table, label: string): Table {
  if (table.columns.length >= TABLE_MAX_COLUMNS) return table;
  return { columns: [...table.columns, { id: id(), label, align: 'left' }], rows: table.rows.map((row) => ({ ...row, cells: [...row.cells, ''] })) };
}

/** Quita la columna `index` y su celda de cada fila (siempre queda al menos una). */
export function removeTableColumn(table: Table, index: number): Table {
  if (table.columns.length <= 1) return table;
  return { columns: table.columns.filter((_, i) => i !== index), rows: table.rows.map((row) => ({ ...row, cells: row.cells.filter((_, i) => i !== index) })) };
}

/** Mueve la columna `from` a `to` (las celdas se mueven con ella). */
export function moveTableColumn(table: Table, from: number, to: number): Table {
  if (to < 0 || to >= table.columns.length) return table;
  const move = <T,>(list: T[]) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  return { columns: move(table.columns), rows: table.rows.map((row) => ({ ...row, cells: move(Array.from({ length: table.columns.length }, (_, i) => row.cells[i] ?? '')) })) };
}
