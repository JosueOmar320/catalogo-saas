/**
 * Lógica del horario SIN zod: la importan los componentes del sitio público
 * (OpenNow, el pedido) para no cargar el validador en el navegador. Los
 * esquemas y la validación viven en ./schedule.ts, que reexporta todo esto.
 */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SCHEMA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY = 24 * 60;
const WEEK = 7 * DAY;

export const MAX_SPECIAL_DAYS = 30;

export type ScheduleRange = { from: string; to: string };
export type ScheduleDay = { open: boolean; ranges: ScheduleRange[] };
/** Un día especial: cerrado o con otro horario esa fecha ("Día de Muertos", "Nochebuena"). */
export type SpecialDay = ScheduleDay & { date: string; note: string };
/** Horario por día del negocio (businesses.contact.schedule). Lunes = 0. */
export type Schedule = {
  enabled: boolean;
  /** Zona horaria IANA del negocio; vacía = la del visitante. */
  timezone: string;
  days: ScheduleDay[];
  special: SpecialDay[];
};

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const weekday = (from: string, to: string): ScheduleDay => ({ open: true, ranges: [{ from, to }] });
/** Lunes a viernes 9–18, sábado 10–14, domingo cerrado. */
export const DEFAULT_SCHEDULE_DAYS: ScheduleDay[] = [...Array.from({ length: 5 }, () => weekday('09:00', '18:00')), weekday('10:00', '14:00'), { open: false, ranges: [] }];

const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const toTime = (minutes: number) => {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Día de la semana (lunes = 0) y minuto del día en la zona del negocio. */
export function zonedNow(date: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || undefined, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { day: Math.max(0, day), minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
}

/** "2026-10-19" de hoy en la zona horaria (vacía = la del sistema). */
const todayIn = (timeZone: string, now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const addDays = (date: string, days: number) => new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + days)).toISOString().slice(0, 10);

/** Horario de una fecha: el día especial si lo hay, si no el de ese día de la semana (lunes = 0). */
export function dayFor(schedule: Schedule, date: string, weekday: number): ScheduleDay {
  return schedule.special.find((d) => d.date === date) ?? schedule.days[weekday];
}

/**
 * Turnos de `from` a `to` días desde hoy como intervalos [inicio, fin) en
 * minutos desde hoy a las 0:00 (zona del negocio), unidos si se tocan.
 */
function intervals(schedule: Schedule, today: string, weekday: number, from = -1, to = 15): [number, number][] {
  const raw: [number, number][] = [];
  for (let offset = from; offset <= to; offset++) {
    const day = dayFor(schedule, addDays(today, offset), (((weekday + offset) % 7) + 7) % 7);
    if (!day.open) continue;
    for (const { from: a, to: b } of day.ranges) {
      const start = offset * DAY + toMinutes(a);
      const length = toMinutes(b) > toMinutes(a) ? toMinutes(b) - toMinutes(a) : toMinutes(b) - toMinutes(a) + DAY;
      raw.push([start, start + length]);
    }
  }
  raw.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of raw) {
    const last = merged.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

export type OpenStatus =
  | { open: true; closesAt: string | null }
  /** `inDays`: 0 = hoy, 1 = mañana…; `day`: lunes = 0. */
  | { open: false; opensAt: { inDays: number; day: number; time: string } | null };

export function openStatus(schedule: Schedule, now: Date): OpenStatus {
  const { day, minutes } = zonedNow(now, schedule.timezone);
  const list = intervals(schedule, todayIn(schedule.timezone, now), day);
  const active = list.find(([a, b]) => a <= minutes && minutes < b);
  // Abierto todo el tiempo (24/7): no hay hora de cierre.
  if (active) return { open: true, closesAt: active[1] - active[0] >= WEEK ? null : toTime(active[1]) };
  const next = list.find(([a]) => a > minutes);
  if (!next) return { open: false, opensAt: null };
  const inDays = Math.floor(next[0] / DAY);
  return { open: false, opensAt: { inDays, day: (day + inDays) % 7, time: toTime(next[0]) } };
}

/** ¿Ahora está dentro de un horario del día ("07:00"–"12:00"; si `to` ≤ `from`, cruza la medianoche)? */
export function withinHours(hours: { from: string; to: string }, timeZone: string, now: Date): boolean {
  const { minutes } = zonedNow(now, timeZone);
  const from = toMinutes(hours.from);
  const to = toMinutes(hours.to);
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/** "09:00" → "9:00" (como se escribe un horario). */
export const shortTime = (value: string) => value.replace(/^0(\d)/, '$1');

/**
 * Filas para mostrar el horario, agrupando días seguidos iguales:
 * [{ from: 0, to: 4, ranges: ['9:00 – 18:00'] }, { from: 6, to: 6, ranges: [] }].
 */
export function scheduleRows(schedule: Schedule): { from: number; to: number; ranges: string[] }[] {
  const key = (day: ScheduleDay) => (day.open && day.ranges.length ? day.ranges.map((r) => `${shortTime(r.from)} – ${shortTime(r.to)}`) : []);
  const rows: { from: number; to: number; ranges: string[] }[] = [];
  schedule.days.forEach((day, index) => {
    const ranges = key(day);
    const last = rows.at(-1);
    if (last && last.ranges.join() === ranges.join()) last.to = index;
    else rows.push({ from: index, to: index, ranges });
  });
  return rows;
}

/** Nombre corto del día en el idioma del sitio (lunes = 0). 1 de enero de 2024 fue lunes. */
export const weekdayName = (day: number, locale: string, width: 'short' | 'long' = 'short') =>
  new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + day)));

/** Texto del horario, una línea por grupo de días ("lun – vie: 9:00 – 18:00"). */
export function scheduleText(schedule: Schedule, locale: string, closedLabel: string): string {
  return scheduleRows(schedule)
    .map(({ from, to, ranges }) => {
      const days = from === to ? weekdayName(from, locale) : `${weekdayName(from, locale)} – ${weekdayName(to, locale)}`;
      return `${days}: ${ranges.length ? ranges.join(', ') : closedLabel}`;
    })
    .join('\n');
}

/** Días especiales de hoy en adelante (hasta `days` días), en orden. */
export function upcomingSpecialDays(schedule: Schedule, now: Date, days = 45): SpecialDay[] {
  if (!schedule.special.length) return [];
  const today = todayIn(schedule.timezone, now);
  const last = addDays(today, days);
  return schedule.special.filter((d) => d.date >= today && d.date <= last).sort((a, b) => a.date.localeCompare(b.date));
}

/** "sáb 1 nov: Cerrado · Día de Muertos", una línea por día especial próximo (máximo 5). */
export function specialDaysText(schedule: Schedule, locale: string, closedLabel: string, now: Date): string {
  const date = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return upcomingSpecialDays(schedule, now)
    .slice(0, 5)
    .map((d) => {
      const hours = d.open && d.ranges.length ? d.ranges.map((r) => `${shortTime(r.from)} – ${shortTime(r.to)}`).join(', ') : closedLabel;
      return `${date.format(new Date(`${d.date}T12:00:00Z`))}: ${hours}${d.note ? ` · ${d.note}` : ''}`;
    })
    .join('\n');
}

/** Días especiales próximos para los buscadores (schema.org). */
export function specialOpeningHoursSpecification(schedule: Schedule, now: Date) {
  return upcomingSpecialDays(schedule, now, 90).flatMap((d) =>
    (d.open && d.ranges.length ? d.ranges : [{ from: '00:00', to: '00:00' }]).map((r) => ({
      '@type': 'OpeningHoursSpecification',
      opens: r.from,
      closes: r.to,
      validFrom: d.date,
      validThrough: d.date,
    })),
  );
}

/** Para los datos estructurados (schema.org) del negocio. */
export function openingHoursSpecification(schedule: Schedule) {
  return schedule.days.flatMap((day, index) =>
    day.open
      ? day.ranges.map((range) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${SCHEMA_DAYS[index]}`, opens: range.from, closes: range.to }))
      : [],
  );
}

/* ------------------------------------------------------- Horarios para pedidos */

/** `offset`: 0 = hoy, 1 = mañana… (en la zona del negocio); `day`: lunes = 0. */
export type PickupDay = { date: string; day: number; offset: number; slots: string[] };

/** Horario de respaldo cuando el negocio no configuró el suyo: todos los días de 9:00 a 20:00. */
export const FALLBACK_HOURS: Schedule = {
  enabled: true,
  timezone: '',
  days: Array.from({ length: 7 }, () => ({ open: true, ranges: [{ from: '09:00', to: '20:00' }] })),
  special: [],
};

/**
 * Días y horas en que se puede pedir para recoger o recibir: dentro del
 * horario del negocio, cada `step` minutos y al menos `leadMinutes` después de
 * ahora (tiempo de preparación). Todo en la zona horaria del negocio. Los
 * turnos que cruzan la medianoche se cortan a las 24:00 de ese día.
 */
export function pickupSlots(schedule: Schedule | null, now: Date, { leadMinutes = 60, days = 7, step = 30 }: { leadMinutes?: number; days?: number; step?: number } = {}): PickupDay[] {
  const source = schedule?.enabled ? schedule : FALLBACK_HOURS;
  const { day: weekday, minutes } = zonedNow(now, source.timezone);
  const today = todayIn(source.timezone, now);
  const earliest = minutes + leadMinutes; // minutos desde hoy 0:00
  const result: PickupDay[] = [];
  for (let offset = 0; offset < days; offset++) {
    const index = (weekday + offset) % 7;
    const date = addDays(today, offset);
    const config = dayFor(source, date, index);
    if (!config.open) continue;
    const slots = new Set<string>();
    for (const { from, to } of config.ranges) {
      const start = toMinutes(from);
      const end = toMinutes(to) > start ? toMinutes(to) : DAY;
      for (let slot = Math.ceil(start / step) * step; slot < end; slot += step) {
        if (offset * DAY + slot >= earliest) slots.add(toTime(slot));
      }
    }
    if (slots.size) result.push({ date, day: index, offset, slots: [...slots].sort() });
  }
  return result;
}

/** "jueves 23 de octubre, 10:30" en el idioma del sitio. */
export function formatPickup(date: string, time: string, locale: string): string {
  const day = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  return `${day}, ${shortTime(time)}`;
}
