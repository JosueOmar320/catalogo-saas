import { z } from 'zod';
import { isTimeZone } from '@/lib/business/schedule-core';
import type { SaleEnds } from './sale-core';

/**
 * Oferta con fecha de fin: el precio anterior tachado se muestra hasta el
 * final de ese día en la zona horaria de quien la programó; después el
 * producto vuelve solo a su precio normal (web y PDF), sin tocar la base.
 * La lógica (isSaleOver…) vive en ./sale-core.ts, sin zod, para el navegador.
 */
export * from './sale-core';

export const saleEndsSchema = z
  .object({
    on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeZone: z.string().max(64).refine(isTimeZone),
  })
  .nullable()
  .default(null);

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _saleTypesMatch: Equal<NonNullable<z.output<typeof saleEndsSchema>>, SaleEnds> = true;
void _saleTypesMatch;
