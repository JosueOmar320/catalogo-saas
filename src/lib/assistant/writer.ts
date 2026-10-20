import { z } from 'zod';

/**
 * "Escribir con Garfield": textos que Garfield propone en los formularios del
 * panel. Garfield sólo PROPONE (2–3 opciones); el usuario elige, edita y
 * guarda con el formulario de siempre (sus validaciones y permisos).
 */
export const WRITE_KINDS = ['item_short', 'item_description', 'business_slogan', 'business_description', 'seo_title', 'seo_description'] as const;
export type WriteKind = (typeof WRITE_KINDS)[number];

/** Largo máximo (el del campo) y el ideal que se le pide al modelo. */
export const WRITE_LIMITS: Record<WriteKind, { max: number; ideal: number }> = {
  item_short: { max: 300, ideal: 140 },
  item_description: { max: 5000, ideal: 700 },
  business_slogan: { max: 160, ideal: 70 },
  business_description: { max: 500, ideal: 350 },
  seo_title: { max: 70, ideal: 60 },
  seo_description: { max: 160, ideal: 155 },
};

const text = (max: number) => z.string().trim().max(max).default('');

export const writeRequestSchema = z.object({
  kind: z.enum(WRITE_KINDS),
  /** Texto actual del campo (para mejorarlo o partir de él). */
  current: text(5000),
  /** Pedido opcional: "más corto", "tono formal", "menciona que es artesanal"… */
  instruction: text(200),
  /** Datos del producto o servicio del formulario (aún sin guardar). */
  item: z
    .object({
      name: text(160),
      type: z.enum(['product', 'service']).default('product'),
      category: text(120),
      price: text(40),
      details: text(1000),
    })
    .optional(),
});
export type WriteRequest = z.input<typeof writeRequestSchema>;

/** Respuesta del modelo: las opciones, ya recortadas al largo del campo por el servidor. */
export const writeResultSchema = z.object({ options: z.array(z.string().min(1).max(6000)).min(1).max(3) });

/** Limpia una opción: sin comillas envolventes ni espacios de más, y dentro del largo del campo. */
export function cleanOption(kind: WriteKind, value: string): string {
  const { max } = WRITE_LIMITS[kind];
  const single = kind !== 'item_description' && kind !== 'business_description';
  let out = value.trim().replace(/^["“«']+|["”»']+$/g, '').trim();
  if (single) out = out.replace(/\s*\n+\s*/g, ' ');
  if (out.length <= max) return out;
  // Corta en la última palabra completa.
  const cut = out.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trim()}…`;
}
