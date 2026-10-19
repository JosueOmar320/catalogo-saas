import 'server-only';
import { headers } from 'next/headers';
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Límite de intentos compartido por todas las instancias (tabla + función en
 * Postgres, migración 20261020). En serverless un contador en memoria no sirve:
 * cada instancia tiene el suyo.
 *
 * Si la service role no está configurada o la base no responde, deja pasar
 * (fail-open) y lo registra: un límite caído no debe impedir iniciar sesión.
 */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!isServiceRoleConfigured()) return true;
  const { data, error } = await createAdminClient().rpc('rate_limit_consume', { p_key: key.slice(0, 200), p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error('[rate-limit] no se pudo consultar el límite', { key: key.split(':')[0], code: error.code });
    return true;
  }
  return data !== false;
}

/** IP del cliente según el proxy de la plataforma (Vercel la fija en x-forwarded-for / x-real-ip). */
export async function clientIp(): Promise<string> {
  const list = await headers();
  return list.get('x-real-ip') ?? list.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
