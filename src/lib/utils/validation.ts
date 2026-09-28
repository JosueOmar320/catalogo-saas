import { z } from 'zod';
import { fail, type ActionResult } from './result';

/** Valida la entrada de una Server Action y devuelve errores por campo. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { success: true; data: z.output<S> } | { success: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data };
  const flat = z.flattenError(parsed.error);
  return {
    success: false,
    result: fail('Revisa los campos marcados.', flat.fieldErrors as Record<string, string[] | undefined>),
  };
}

/** Precio como texto de formulario: "" | "12" | "12.50". */
export const priceText = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{1,10}([.,]\d{1,2})?$/.test(v), 'Usa un número, ej. 120 o 99.90');

export function priceToNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value.replace(',', '.'));
}

export const uuidSchema = z.uuid();
