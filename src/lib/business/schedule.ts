import { z } from 'zod';
import { msg } from '@/i18n/translate';

/**
 * Horario por día del negocio (businesses.contact.schedule). Con él, el sitio
 * dice "Abierto ahora · cierra a las 18:00" y el pedido avisa si está cerrado.
 * Los días van de lunes (0) a domingo (6); un turno que termina a la misma
 * hora o antes de empezar cruza la medianoche (18:00–02:00).
 */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SCHEMA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY = 24 * 60;
const WEEK = 7 * DAY;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, msg('Usa el formato 24 h, ej. 09:00'));
const rangeSchema = z.object({ from: time, to: time });
const daySchema = z.object({ open: z.boolean().default(false), ranges: z.array(rangeSchema).max(3).default([]) });

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const weekday = (from: string, to: string) => ({ open: true, ranges: [{ from, to }] });
const DEFAULT_DAYS = [...Array.from({ length: 5 }, () => weekday('09:00', '18:00')), weekday('10:00', '14:00'), { open: false, ranges: [] }];

export const scheduleSchema = z.object({
  enabled: z.boolean().default(false),
  /** Zona horaria IANA del negocio; vacía = la del visitante. */
  timezone: z
    .string()
    .max(64)
    .refine((value) => value === '' || isTimeZone(value), msg('Zona horaria inválida'))
    .default(''),
  days: z.array(daySchema).length(7).default(DEFAULT_DAYS),
});

export type Schedule = z.output<typeof scheduleSchema>;
export type ScheduleDay = Schedule['days'][number];

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

/** Turnos como intervalos de la semana [inicio, fin) en minutos, unidos si se tocan. */
function intervals(schedule: Schedule): [number, number][] {
  const raw = schedule.days.flatMap((day, index) =>
    day.open
      ? day.ranges.map(({ from, to }): [number, number] => {
          const start = index * DAY + toMinutes(from);
          const length = toMinutes(to) > toMinutes(from) ? toMinutes(to) - toMinutes(from) : toMinutes(to) - toMinutes(from) + DAY;
          return [start, start + length];
        })
      : [],
  );
  // Copias una semana antes y después: un turno del domingo que cruza al lunes, etc.
  const all = raw.flatMap(([a, b]): [number, number][] => [[a - WEEK, b - WEEK], [a, b], [a + WEEK, b + WEEK]]).sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of all) {
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
  const current = day * DAY + minutes;
  const list = intervals(schedule);
  const active = list.find(([a, b]) => a <= current && current < b);
  // Abierto todo el tiempo (24/7): no hay hora de cierre.
  if (active) return { open: true, closesAt: active[1] - active[0] >= WEEK ? null : toTime(active[1]) };
  const next = list.find(([a]) => a > current);
  if (!next) return { open: false, opensAt: null };
  const startDay = Math.floor(next[0] / DAY);
  return { open: false, opensAt: { inDays: startDay - day, day: ((startDay % 7) + 7) % 7, time: toTime(next[0]) } };
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

/** Para los datos estructurados (schema.org) del negocio. */
export function openingHoursSpecification(schedule: Schedule) {
  return schedule.days.flatMap((day, index) =>
    day.open
      ? day.ranges.map((range) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${SCHEMA_DAYS[index]}`, opens: range.from, closes: range.to }))
      : [],
  );
}
