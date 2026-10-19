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
