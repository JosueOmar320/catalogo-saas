import { z } from 'zod';
import { msg } from '@/i18n/translate';

export const signInSchema = z.object({
  // Usuario (o email, para cuentas creadas antes de la v4).
  username: z.string().trim().toLowerCase().min(3, msg('Escribe tu usuario')).max(254),
  password: z.string().min(1, msg('Escribe tu contraseña')).max(72),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, msg('Escribe tu contraseña actual')),
    password: z.string().min(8, msg('Mínimo 8 caracteres')).max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: msg('Las contraseñas no coinciden') });

export const accountSchema = z.object({
  fullName: z.string().trim().max(80),
});

export type SignInValues = z.input<typeof signInSchema>;
export type ChangePasswordValues = z.input<typeof changePasswordSchema>;
export type AccountValues = z.input<typeof accountSchema>;
