/** Convierte strings vacíos en null (útil antes de guardar en la BD). */
export function emptyToNull<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: T[K] extends string ? T[K] | null : T[K] } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = typeof value === 'string' && value.trim() === '' ? null : value;
  }
  return out as { [K in keyof T]: T[K] extends string ? T[K] | null : T[K] };
}
