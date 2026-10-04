/**
 * Supabase (PostgREST) devuelve como máximo 1000 filas por consulta (ajuste
 * "Max rows" del proyecto) y CORTA el resultado en silencio. Para listas que
 * pueden crecer (productos, imágenes, usuarios) se lee por páginas.
 * El llamador debe ordenar de forma estable (p. ej. terminar con `id`).
 */
export const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = PAGE_SIZE): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
