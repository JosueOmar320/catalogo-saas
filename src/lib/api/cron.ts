import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/** Resúmenes de largo fijo: ni el largo del encabezado ni su contenido cambian el tiempo de comparación. */
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/** Vercel Cron llama con `Authorization: Bearer <CRON_SECRET>`. Sin CRON_SECRET (16+ caracteres) no responde a nadie. */
export function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  const given = request.headers.get('authorization') ?? '';
  return secret.length >= 16 && timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}
