/**
 * Búsquedas sin resultados: qué se registra y cómo se resume. Puro.
 */

/** Un correo, un teléfono o una URL no son búsquedas de productos: no se guardan. */
export function looksPersonal(term: string): boolean {
  return /@|https?:|www\./i.test(term) || /\d[\d\s().-]{5,}\d/.test(term);
}

export type SearchMiss = { term: string; searches: number };

/** Los términos más buscados de los días leídos (sumados), de más a menos (empates: alfabético). */
export function topSearchMisses(rows: { term: string; searches: number }[], limit = 10): SearchMiss[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.term, (totals.get(row.term) ?? 0) + row.searches);
  return [...totals]
    .map(([term, searches]) => ({ term, searches }))
    .sort((a, b) => b.searches - a.searches || a.term.localeCompare(b.term))
    .slice(0, limit);
}
