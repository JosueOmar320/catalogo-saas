/**
 * Oferta con fecha de fin, SIN zod (la usan los componentes del sitio
 * público). El esquema vive en ./sale.ts, que reexporta esto.
 */
export type SaleEnds = { on: string; timeZone: string };

/** Fecha de hoy ("2026-10-19") en una zona horaria. */
export const todayIn = (timeZone: string, now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const isSaleOver = (ends: SaleEnds | null, now: Date) => Boolean(ends && todayIn(ends.timeZone, now) > ends.on);

/** "31 de octubre" en el idioma del sitio. */
export const formatSaleDate = (on: string, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${on}T12:00:00Z`));
