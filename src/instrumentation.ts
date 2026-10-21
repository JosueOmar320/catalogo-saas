/**
 * Se ejecuta una vez al arrancar el servidor (Next.js: `register`). Sólo avisa
 * por consola de configuraciones inconsistentes; no cambia nada ni detiene el
 * arranque. Nunca imprime el valor de un secreto.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  for (const warning of configWarnings(process.env)) console.warn(`[config] ${warning}`);
}

const ROUTINGS = ['local-first', 'llm-first', 'local-only'];
const PROVIDERS = ['gemini', 'anthropic', 'openai-compatible', 'basic'];

/** Un aviso por problema (en español, como el resto de los registros del servidor). */
export function configWarnings(env: Record<string, string | undefined>): string[] {
  const warnings: string[] = [];
  const cronSecret = env.CRON_SECRET;
  if (cronSecret !== undefined && cronSecret.length < 16) warnings.push('CRON_SECRET tiene menos de 16 caracteres: /api/cron/* no responderá a nadie.');

  const routing = env.ASSISTANT_ROUTING?.trim();
  if (routing && !ROUTINGS.includes(routing)) warnings.push(`ASSISTANT_ROUTING no es uno de ${ROUTINGS.join(' | ')}: se usa local-first.`);

  const provider = env.ASSISTANT_PROVIDER?.trim().toLowerCase();
  if (provider && !PROVIDERS.includes(provider)) warnings.push(`ASSISTANT_PROVIDER no es uno de ${PROVIDERS.join(' | ')}: se detecta por la clave disponible.`);

  const hasFrom = Boolean(env.EMAIL_FROM);
  const hasResend = Boolean(env.RESEND_API_KEY);
  if (hasFrom !== hasResend) warnings.push(hasFrom ? 'EMAIL_FROM está definido pero falta RESEND_API_KEY: no se envían correos.' : 'RESEND_API_KEY está definido pero falta EMAIL_FROM: no se envían correos.');

  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl !== undefined && !/^https?:\/\/[^\s/]+/i.test(siteUrl)) warnings.push('NEXT_PUBLIC_SITE_URL no es una URL http(s) completa (p. ej. https://midominio.com).');

  return warnings;
}
