import { z } from 'zod';
import { SOCIAL_NETWORK_IDS } from '@/lib/social/networks';
import { msg } from '@/i18n/translate';
import { scheduleSchema, scheduleText, specialDaysText } from './schedule';

const optionalText = (max: number) => z.string().trim().max(max).default('');
/** Sólo http(s): estas URLs se muestran como enlaces (evita javascript:, data:…). */
const webUrl = () => z.url({ protocol: /^https?$/, error: msg('Usa una URL que empiece con https://') });

/** Datos de contacto del negocio (businesses.contact). */
export const contactSchema = z.object({
  phone: optionalText(40),
  whatsapp: optionalText(40).refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), {
    message: msg('Usa el formato internacional, ej. +52 55 1234 5678'),
  }),
  email: z.union([z.literal(''), z.email(msg('Email inválido'))]).default(''),
  address: optionalText(200),
  city: optionalText(80),
  website: z.union([z.literal(''), webUrl()]).default(''),
  mapsUrl: z.union([z.literal(''), webUrl()]).default(''),
  /** Ubicación para el mapa ("lat,lng" o nombre), sacada de `mapsUrl` en el servidor al guardar. */
  mapsLocation: optionalText(120),
  /** Horario en texto libre; con `schedule` activo, sirve para notas ("Festivos cerrado"). */
  hours: optionalText(400),
  /** Horario por día: "Abierto ahora" en el sitio y aviso en el pedido. */
  schedule: scheduleSchema.prefault({}),
  /** Información adicional: formas de pago, envíos, estacionamiento… */
  additionalInfo: optionalText(500),
});

export type BusinessContact = z.output<typeof contactSchema>;

export const socialLinkSchema = z.object({
  network: z.enum(SOCIAL_NETWORK_IDS),
  url: webUrl().max(300),
});

export const socialLinksSchema = z.array(socialLinkSchema).max(12);
export type SocialLink = z.output<typeof socialLinkSchema>;

/** Lee el contacto guardado. Un campo inválido (p. ej. de una versión anterior) se descarta sin perder los demás. */
export function parseContact(raw: unknown): BusinessContact {
  const input: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  const result = contactSchema.safeParse(input);
  if (result.success) return result.data;
  for (const issue of result.error.issues) delete input[String(issue.path[0])];
  return contactSchema.safeParse(input).data ?? contactSchema.parse({});
}

export function parseSocialLinks(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const result = socialLinkSchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}

export { digitsOnly } from '@/lib/utils/phone';

/**
 * Horario para mostrar: el horario por día (si está activo), los días
 * especiales próximos y las notas en texto libre.
 */
export function hoursText(contact: Pick<BusinessContact, 'hours' | 'schedule'>, locale: string, closedLabel: string, now: Date = new Date()): string {
  if (!contact.schedule.enabled) return contact.hours;
  return [scheduleText(contact.schedule, locale, closedLabel), specialDaysText(contact.schedule, locale, closedLabel, now), contact.hours].filter(Boolean).join('\n');
}
