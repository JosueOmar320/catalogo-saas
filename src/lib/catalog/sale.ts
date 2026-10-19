import { z } from 'zod';
import { isTimeZone } from '@/lib/business/schedule';

/**
 * Oferta con fecha de fin: el precio anterior tachado se muestra hasta el
 * final de ese día en la zona horaria de quien la programó; después el
 * producto vuelve solo a su precio normal (web y PDF), sin tocar la base.
 */
export const saleEndsSchema = z
  .object({
    on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeZone: z.string().max(64).refine(isTimeZone),
  })
  .nullable()
  .default(null);

export type SaleEnds = NonNullable<z.output<typeof saleEndsSchema>>;

/** Fecha de hoy ("2026-10-19") en una zona horaria. */
export const todayIn = (timeZone: string, now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const isSaleOver = (ends: SaleEnds | null, now: Date) => Boolean(ends && todayIn(ends.timeZone, now) > ends.on);

/** "31 de octubre" en el idioma del sitio. */
export const formatSaleDate = (on: string, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${on}T12:00:00Z`));
