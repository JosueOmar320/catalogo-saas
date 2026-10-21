import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { DEFAULT_SCHEDULE_DAYS, isTimeZone, MAX_SPECIAL_DAYS, type Schedule } from './schedule-core';

/**
 * Horario por día del negocio (businesses.contact.schedule). Con él, el sitio
 * dice "Abierto ahora · cierra a las 18:00" y el pedido avisa si está cerrado.
 * Los días van de lunes (0) a domingo (6); un turno que termina a la misma
 * hora o antes de empezar cruza la medianoche (18:00–02:00). Los días
 * especiales (feriados, vacaciones, horario corto) reemplazan al de la semana
 * en esa fecha.
 *
 * La lógica (abierto ahora, horarios para pedir…) vive en ./schedule-core.ts,
 * sin zod, para el navegador del sitio público; aquí sólo los esquemas.
 */
export * from './schedule-core';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, msg('Usa el formato 24 h, ej. 09:00'));
const rangeSchema = z.object({ from: time, to: time });
const daySchema = z.object({ open: z.boolean().default(false), ranges: z.array(rangeSchema).max(3).default([]) });
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg('Elige una fecha'));

/** Un día especial: cerrado o con otro horario esa fecha ("Día de Muertos", "Nochebuena"). */
export const specialDaySchema = daySchema.extend({
  date: dateSchema,
  note: z.string().trim().max(60).default(''),
});

export const scheduleSchema = z.object({
  enabled: z.boolean().default(false),
  /** Zona horaria IANA del negocio; vacía = la del visitante. */
  timezone: z
    .string()
    .max(64)
    .refine((value) => value === '' || isTimeZone(value), msg('Zona horaria inválida'))
    .default(''),
  days: z.array(daySchema).length(7).default(DEFAULT_SCHEDULE_DAYS),
  special: z
    .array(specialDaySchema)
    .max(MAX_SPECIAL_DAYS)
    .refine((list) => new Set(list.map((d) => d.date)).size === list.length, msg('Hay dos días especiales con la misma fecha'))
    .default([]),
});

// El tipo escrito a mano en schedule-core debe coincidir con el esquema (falla al compilar si divergen).
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _scheduleTypesMatch: Mutual<z.output<typeof scheduleSchema>, Schedule> = true;
void _scheduleTypesMatch;
