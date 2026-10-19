import { z } from 'zod';
import { msg } from '@/i18n/translate';
import { usernameSchema } from '@/lib/auth/username';
import { THEME_PRESETS } from '@/lib/design/presets';
import { businessSlugSchema } from '@/features/business/schema';

export const MEMBER_ROLES = ['owner', 'admin', 'editor'] as const;
export const MEMBER_ROLE_LABELS: Record<(typeof MEMBER_ROLES)[number], string> = { owner: msg('Dueño'), admin: msg('Administrador'), editor: msg('Editor') };

const optionalEmail = z.union([z.literal(''), z.email(msg('Email inválido')).max(254)]).default('');
const maxBusinesses = z.union([z.literal(''), z.coerce.number().int().min(0).max(1000)]).default('');

export const assignmentSchema = z.object({ businessId: z.uuid(), role: z.enum(MEMBER_ROLES) });

export const createUserSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().max(80).default(''),
  email: optionalEmail,
  password: z.string().min(8, msg('Mínimo 8 caracteres')).max(72),
  role: z.enum(['user', 'admin']).default('user'),
  maxBusinesses,
  assignments: z.array(assignmentSchema).max(50).default([]),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().max(80).default(''),
  email: optionalEmail,
  role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'disabled']),
  maxBusinesses,
});

export const resetPasswordSchema = z.object({ password: z.string().min(8, msg('Mínimo 8 caracteres')).max(72) });

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, msg('Escribe el nombre')).max(120),
  slug: businessSlugSchema,
  ownerId: z.union([z.literal(''), z.uuid()]).default(''),
  planId: z.string().min(1).max(40).default('free'),
  presetId: z.enum(THEME_PRESETS.map((p) => p.id) as [string, ...string[]]).default('minimal'),
  offering: z.enum(['products', 'services', 'both']).default('products'),
  whatsapp: z.string().trim().max(30).default(''),
});

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: businessSlugSchema,
  planId: z.string().min(1).max(40),
  status: z.enum(['active', 'suspended']),
});

export const updateCatalogSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean(),
  makeDefault: z.boolean().default(false),
});

export type CreateUserValues = z.input<typeof createUserSchema>;
export type UpdateUserValues = z.input<typeof updateUserSchema>;
export type CreateBusinessValues = z.input<typeof createBusinessSchema>;
export type UpdateBusinessValues = z.input<typeof updateBusinessSchema>;
export type UpdateCatalogValues = z.input<typeof updateCatalogSchema>;
