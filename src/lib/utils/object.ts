/** Convierte strings vacíos en null (útil antes de guardar en la BD). */
export function emptyToNull<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: T[K] extends string ? T[K] | null : T[K] } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = typeof value === 'string' && value.trim() === '' ? null : value;
  }
  return out as { [K in keyof T]: T[K] extends string ? T[K] | null : T[K] };
}

export type PlainObject = Record<string, unknown>;

export const isPlainObject = (value: unknown): value is PlainObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Mezcla profunda de objetos planos: los arreglos y valores simples se reemplazan. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: PlainObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out as T;
}
