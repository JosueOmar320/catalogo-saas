import { todayIn, type SaleEnds } from './sale-core';

/**
 * Productos de temporada (pan de muerto, roscas): se ven en el sitio sólo
 * entre esas fechas (cualquiera puede faltar), en la zona horaria de quien
 * las programó. Fuera de temporada siguen en el panel.
 */
export type Season = { from: string; until: string; timeZone: string };

export type SeasonStatus = 'upcoming' | 'active' | 'ended';

export function seasonStatus(season: Season | null, now: Date): SeasonStatus | null {
  if (!season) return null;
  const today = todayIn(season.timeZone, now);
  if (season.from && today < season.from) return 'upcoming';
  if (season.until && today > season.until) return 'ended';
  return 'active';
}

/** ¿Se muestra hoy en el sitio? Sin temporada, siempre. */
export const inSeason = (season: Season | null, now: Date) => {
  const status = seasonStatus(season, now);
  return status === null || status === 'active';
};

/** La temporada como fin de oferta (mismo cálculo de "terminó ese día"). */
export const seasonEnds = (season: Season | null): SaleEnds | null => (season?.until ? { on: season.until, timeZone: season.timeZone } : null);
