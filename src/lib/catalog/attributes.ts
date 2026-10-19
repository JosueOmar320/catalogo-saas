import { z } from 'zod';
import { fieldFactory } from '@/lib/design/schema-utils';
import { msg } from '@/i18n/translate';

/**
 * Atributos personalizados, definidos por cada negocio (catalogs.attribute_defs).
 * Una ferretería define Marca/Modelo/Material; un restaurante Tamaño/Calorías;
 * un servicio Duración/Modalidad/Incluye. Nada está atado a una industria.
 * Los valores viven en catalog_items.attributes.values[attributeId].
 */
export const ATTRIBUTE_TYPES = ['text', 'number', 'select', 'boolean', 'list'] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: msg('Texto'),
  number: msg('Número'),
  select: msg('Opciones'),
  boolean: msg('Sí / No'),
  list: msg('Lista (características)'),
};

function build(lenient: boolean) {
  const f = fieldFactory(lenient);
  return z.object({
    id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(1, msg('Escribe un nombre')).max(40),
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
  .refine((defs) => new Set(defs.map((d) => d.id)).size === defs.length, msg('Hay atributos repetidos'));

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

export { parseAttributeValues, formatAttributeValue, visibleAttributes, type ResolvedAttribute } from './attributes-core';
