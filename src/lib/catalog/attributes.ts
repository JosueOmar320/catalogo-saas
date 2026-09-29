import { z } from 'zod';
import { fieldFactory } from '@/lib/design/schema-utils';

/**
 * Atributos personalizados, definidos por cada negocio (catalogs.attribute_defs).
 * Una ferretería define Marca/Modelo/Material; un restaurante Tamaño/Calorías;
 * un servicio Duración/Modalidad/Incluye. Nada está atado a una industria.
 * Los valores viven en catalog_items.attributes.values[attributeId].
 */
export const ATTRIBUTE_TYPES = ['text', 'number', 'select', 'boolean', 'list'] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: 'Texto',
  number: 'Número',
  select: 'Opciones',
  boolean: 'Sí / No',
  list: 'Lista (características)',
};

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  return z.object({
    id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(1, 'Escribe un nombre').max(40),
    type: f(z.enum(ATTRIBUTE_TYPES), 'text'),
    unit: f(z.string().trim().max(12), ''),
    options: f(z.array(z.string().trim().min(1).max(40)).max(40), []),
    filterable: f(z.boolean(), false),
    showInCard: f(z.boolean(), false),
    showInDetail: f(z.boolean(), true),
    showInPdf: f(z.boolean(), true),
  });
}

export const attributeDefSchema = build(false);
const lenientAttributeDef = build(true);
export const attributeDefsSchema = z
  .array(attributeDefSchema)
  .max(40)
  .refine((defs) => new Set(defs.map((d) => d.id)).size === defs.length, 'Hay atributos repetidos');

export type AttributeDef = z.output<typeof attributeDefSchema>;
export type AttributeValue = string | number | boolean | string[];
export type AttributeValues = Record<string, AttributeValue>;

export function parseAttributeDefs(raw: unknown): AttributeDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const r = lenientAttributeDef.safeParse(entry);
    return r.success ? [r.data] : [];
  });
}

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

export function attributeIdFromName(name: string, taken: string[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'atributo';
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}
