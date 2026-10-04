import type { AttributeDef, AttributeValue, AttributeValues } from './attributes';

/** Lectura y formato de atributos SIN zod (se usa en el navegador). `attributes.ts` lo re-exporta. */

/** Normaliza los valores guardados de un ítem según las definiciones actuales. */
export function parseAttributeValues(raw: unknown, defs: AttributeDef[]): AttributeValues {
  const values = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: AttributeValues = {};
  for (const def of defs) {
    const v = values[def.id];
    if (v === undefined || v === null || v === '') continue;
    if (def.type === 'number' && typeof v === 'number' && Number.isFinite(v)) out[def.id] = v;
    else if (def.type === 'boolean' && typeof v === 'boolean') out[def.id] = v;
    else if (def.type === 'list' && Array.isArray(v)) out[def.id] = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 20);
    else if ((def.type === 'text' || def.type === 'select') && typeof v === 'string') out[def.id] = v.slice(0, 200);
  }
  return out;
}

/** Texto para mostrar un valor ("12 kg", "Sí", "Rojo, Azul"). */
export function formatAttributeValue(def: AttributeDef, value: AttributeValue | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return `${value}${def.unit ? ` ${def.unit}` : ''}`;
}

export type ResolvedAttribute = { id: string; name: string; value: string; list?: string[] };

/** Atributos visibles de un ítem para un contexto (tarjeta, detalle o PDF). */
export function visibleAttributes(values: AttributeValues, defs: AttributeDef[], context: 'card' | 'detail' | 'pdf'): ResolvedAttribute[] {
  return defs.flatMap((def) => {
    const shown = context === 'card' ? def.showInCard : context === 'detail' ? def.showInDetail : def.showInPdf;
    const value = values[def.id];
    if (!shown || value === undefined) return [];
    return [{ id: def.id, name: def.name, value: formatAttributeValue(def, value), list: Array.isArray(value) ? value : undefined }];
  });
}
