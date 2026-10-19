import { z } from 'zod';
import { msg } from '@/i18n/translate';

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, msg('Usa un color hexadecimal, ej. #1A1A1A'));

/**
 * Crea un campo con default. En modo tolerante, un valor inválido guardado
 * (p. ej. una opción retirada) cae a su default en vez de romper el sitio.
 * Los formularios y las Server Actions usan el modo estricto.
 */
export function fieldFactory(lenient: boolean) {
  return <S extends z.ZodType>(schema: S, fallback: z.output<S>) =>
    (lenient ? schema.default(fallback as never).catch(fallback as never) : schema.default(fallback as never)) as unknown as z.ZodDefault<S>;
}
