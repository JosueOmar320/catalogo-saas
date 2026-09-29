import { z } from 'zod';
import { assistantActionSchema } from './actions';
import { COLLECTION_LABELS, COLLECTION_SOURCES, SORT_LABELS, SORT_OPTIONS } from '@/lib/catalog/collections';
import { LAYOUT_OPTIONS, PRODUCT_LAYOUT_META, PRODUCT_LAYOUTS } from '@/lib/catalog/presentation';
import { buildBackgroundSchema } from '@/lib/design/background';
import { FONT_IDS, FONTS } from '@/lib/design/fonts';
import { ICON_IDS } from '@/lib/design/icons';
import { PATTERN_IDS } from '@/lib/design/patterns';
import { THEME_PRESETS } from '@/lib/design/presets';
import { CARD_STYLE_META, CARD_STYLES, FOOTER_STYLES, HEADER_STYLE_META, HEADER_STYLES } from '@/lib/design/styles-registry';
import { themeSchema } from '@/lib/design/theme';
import { PAGE_BLUEPRINT_DEFS, PAGE_BLUEPRINT_IDS } from '@/lib/site/blueprints';
import { SECTION_META } from '@/lib/site/section-registry';
import { SECTION_TYPES, sectionSchemas, sectionStyleSchema } from '@/lib/site/section-schemas';

/**
 * Guía de capacidades para el modelo, GENERADA desde los registros y schemas
 * existentes: agregar un tipo de sección, un layout, un preset o una fuente
 * se lo enseña automáticamente a Garfield (sin duplicar conocimiento).
 */

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  default?: unknown;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  format?: string;
  pattern?: string;
  description?: string;
  required?: string[];
};

type CompactOptions = { describe?: boolean };

/** JSON Schema → firma compacta tipo TypeScript (pocos tokens). */
function compact(schema: JsonSchema, depth = 0, opts: CompactOptions = {}): string {
  const def = schema.default !== undefined && typeof schema.default !== 'object' ? ` = ${JSON.stringify(schema.default)}` : '';
  // La lista de íconos va una sola vez al final de la guía.
  if (schema.enum && schema.enum.length > 25) return `IconId${def}`;
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join('|') + def;
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  const union = schema.anyOf ?? schema.oneOf;
  if (union) return union.map((s) => compact(s, depth, opts)).join(' | ') + def;
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  switch (type) {
    case 'object': {
      if (!schema.properties) return 'object';
      if (depth > 4) return 'object';
      return `{ ${Object.entries(schema.properties)
        .map(([key, value]) => {
          // Con describe: "?" para opcionales y la descripción como comentario.
          const optional = opts.describe && !schema.required?.includes(key) ? '?' : '';
          const note = opts.describe && value.description ? ` /* ${value.description} */` : '';
          return `${key}${optional}: ${compact(value, depth + 1, opts)}${note}`;
        })
        .join('; ')} }`;
    }
    case 'array':
      return `${schema.items ? compact(schema.items, depth + 1, opts) : 'unknown'}[]`;
    case 'string':
      return `string${schema.format === 'uuid' ? '(uuid)' : schema.maxLength ? `(≤${schema.maxLength})` : ''}${def}`;
    case 'integer':
    case 'number':
      return `${type === 'integer' ? 'int' : 'number'}${schema.minimum !== undefined && schema.maximum !== undefined ? `(${schema.minimum}–${schema.maximum})` : ''}${def}`;
    case 'boolean':
      return `boolean${def}`;
    default:
      return 'unknown';
  }
}

/** Firma compacta de un schema Zod (parámetros de herramientas, etc.). */
export function zodSignature(schema: z.ZodType, describe = true): string {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  return compact(json, 0, { describe });
}

function signature(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  return compact(json);
}

/**
 * Formato de respuesta en texto (para proveedores sin herramientas o en modo
 * JSON): la misma lista de acciones, generada del schema Zod.
 */
export function responseFormatGuide(): string {
  const json = z.toJSONSchema(assistantActionSchema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  const actions = (json.oneOf ?? json.anyOf ?? []).map((member) => `- ${compact(member, 0, { describe: true })}`).join('\n');
  return `## Formato de respuesta (OBLIGATORIO)
Responde SOLO con un objeto JSON válido, sin texto antes ni después y sin bloques de código:
{"message": string (1–3 frases para el usuario), "actions": Action[] (puede ser []), "suggestions": string[] (2–4 siguientes pasos cortos)}

Cada Action es exactamente una de estas (los campos con ? son opcionales; "object" = objeto con los campos de la guía de secciones/tema):
${actions}`;
}

let cached: string | null = null;

/** Texto de referencia (estable, cacheable) con todo lo que Garfield puede usar. */
export function capabilitiesGuide(): string {
  if (cached) return cached;
  const sections = SECTION_TYPES.map((type) => {
    const meta = SECTION_META[type];
    const content = (sectionSchemas[type] as unknown as z.ZodObject<{ content: z.ZodType }>).shape.content;
    return `### ${type} — ${meta.label}\n${meta.description}\ncontent: ${signature(content)}`;
  }).join('\n\n');

  const layouts = PRODUCT_LAYOUTS.map((id) => `- ${id}: ${PRODUCT_LAYOUT_META[id].label}. ${PRODUCT_LAYOUT_META[id].description} Opciones que usa: ${LAYOUT_OPTIONS[id].join(', ')}.`).join('\n');
  const theme = themeSchema.shape;
  cached = `## Tipos de sección (usa SÓLO estos)

${sections}

### Estilo común de cualquier sección (campo "style")
${signature(sectionStyleSchema)}

### Fondo (background) — sitio, página, sección, header o footer
${signature(buildBackgroundSchema(false))}
Patrones disponibles: ${PATTERN_IDS.join(', ')}.

## Presentación de productos (presentation) — secciones products, services y catalog
${layouts}
Para "N productos por fila" cambia presentation.columns.desktop (1–6); tablet 1–4; mobile 1–2.
"Imagen más grande": imageSize "lg", o layout "largeCards" (menos columnas), o ratio "portrait".

## Colecciones (collection) — qué ítems muestra una sección products/services
Fuentes: ${COLLECTION_SOURCES.map((s) => `${s} (${COLLECTION_LABELS[s]})`).join(', ')}.
Orden: ${SORT_OPTIONS.map((s) => `${s} (${SORT_LABELS[s]})`).join(', ')}. limit 0 = sin límite.

## Plantillas de página (blueprint de create_page)
${PAGE_BLUEPRINT_IDS.map((id) => `- ${id}: ${PAGE_BLUEPRINT_DEFS[id].description}`).join('\n')}

## Tema (update_theme)
Presets: ${THEME_PRESETS.map((p) => `${p.id} (${p.name}: ${p.description})`).join('; ')}.
colors: ${signature(theme.colors)}
typography: ${signature(theme.typography)}
Fuentes: ${FONT_IDS.map((id) => `${id} (${FONTS[id].label})`).join(', ')}.
spacing: ${signature(theme.spacing)}
shape: ${signature(theme.shape)}
buttons: ${signature(theme.buttons)}
header: ${signature(theme.header)}
Estilos de header: ${HEADER_STYLES.map((id) => `${id} (${HEADER_STYLE_META[id].label}: ${HEADER_STYLE_META[id].description})`).join('; ')}.
footer: ${signature(theme.footer)} (estilos: ${FOOTER_STYLES.join(', ')})
cards: ${signature(theme.cards)}
Estilos de tarjeta: ${CARD_STYLES.map((id) => `${id} (${CARD_STYLE_META[id].label})`).join('; ')}.
badges: ${signature(theme.badges)}

## Íconos (IconId: features, botones)
${ICON_IDS.join(', ')}
`;
  return cached;
}
