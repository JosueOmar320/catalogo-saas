import { z } from 'zod';

/**
 * Nombre de usuario: la identidad de acceso. Supabase Auth necesita un email
 * por cuenta, así que las cuentas sin email usan un identificador interno NO
 * entregable (`usuario@usuarios.invalid`; .invalid está reservado por RFC 2606)
 * que el usuario nunca ve. El email real, si existe, es un dato de contacto.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, 'De 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.');

export function internalAuthEmail(username: string): string {
  const domain = (process.env.AUTH_USERNAME_DOMAIN || 'usuarios.invalid').replace(/^@/, '');
  return `${username}@${domain}`;
}
