import { z } from 'zod';
import { SOCIAL_NETWORK_IDS } from '@/lib/social/networks';

const optionalText = (max: number) => z.string().trim().max(max).default('');

/** Datos de contacto del negocio (businesses.contact). */
export const contactSchema = z.object({
  phone: optionalText(40),
  whatsapp: optionalText(40).refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), {
    message: 'Usa el formato internacional, ej. +52 55 1234 5678',
  }),
  email: z.union([z.literal(''), z.email('Email inválido')]).default(''),
  address: optionalText(200),
  city: optionalText(80),
  website: z.union([z.literal(''), z.url('URL inválida')]).default(''),
  mapsUrl: z.union([z.literal(''), z.url('URL inválida')]).default(''),
  /** Ubicación para el mapa ("lat,lng" o nombre), sacada de `mapsUrl` en el servidor al guardar. */
  mapsLocation: optionalText(120),
  hours: optionalText(400),
  /** Información adicional: formas de pago, envíos, estacionamiento… */
  additionalInfo: optionalText(500),
});

export type BusinessContact = z.output<typeof contactSchema>;

export const socialLinkSchema = z.object({
  network: z.enum(SOCIAL_NETWORK_IDS),
  url: z.url('URL inválida').max(300),
});

export const socialLinksSchema = z.array(socialLinkSchema).max(12);
export type SocialLink = z.output<typeof socialLinkSchema>;

export function parseContact(raw: unknown): BusinessContact {
  const result = contactSchema.safeParse(raw ?? {});
  return result.success ? result.data : contactSchema.parse({});
}

export function parseSocialLinks(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const result = socialLinkSchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}

/** Número sólo con dígitos, para enlaces wa.me y tel:. */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '');
}
