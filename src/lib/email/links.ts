import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Enlace de baja del aviso por correo: funciona sin iniciar sesión y no se
 * puede falsificar para otro usuario. token = <usuario>.<firma HMAC-SHA256>.
 * La clave deriva de CRON_SECRET (si se cambia, los enlaces viejos dejan de
 * servir y la persona puede apagar el aviso en "Mi cuenta").
 */
const PURPOSE = 'unsubscribe:catalog_review:';

function signature(userId: string, secret: string): Buffer {
  const key = createHmac('sha256', secret).update('email-links').digest();
  return createHmac('sha256', key).update(PURPOSE + userId).digest();
}

export function unsubscribeToken(userId: string, secret: string): string {
  return `${userId}.${signature(userId, secret).toString('base64url')}`;
}

/** Devuelve el id del usuario si el token es válido; null si no. */
export function verifyUnsubscribeToken(token: string | null | undefined, secret: string): string | null {
  if (!token || !secret || token.length > 200) return null;
  const [userId, sig] = token.split('.');
  if (!userId || !sig || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const expected = signature(userId, secret);
  const given = Buffer.from(sig, 'base64url');
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
