import 'server-only';

/**
 * Envío de correos con Resend (API HTTP, sin SDK). Variables:
 *   RESEND_API_KEY  clave de Resend (secreta)
 *   EMAIL_FROM      remitente de un dominio verificado, p. ej. "Vitrina <avisos@tudominio.com>"
 * Sin ambas, nada se envía (los avisos corren en modo de prueba).
 */
export function emailSettings() {
  return { apiKey: process.env.RESEND_API_KEY ?? '', from: process.env.EMAIL_FROM ?? '' };
}

export function isEmailConfigured(): boolean {
  const { apiKey, from } = emailSettings();
  return Boolean(apiKey && from);
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Evita duplicados si el mismo envío se reintenta (Resend lo respeta 24 h). */
  idempotencyKey?: string;
};

export async function sendEmail(email: OutgoingEmail): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { apiKey, from } = emailSettings();
  if (!apiKey || !from) return { ok: false, error: 'not_configured' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(email.idempotencyKey ? { 'Idempotency-Key': email.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text, headers: email.headers }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => null)) as { id?: string; name?: string; message?: string } | null;
    if (!response.ok || !data?.id) return { ok: false, error: data?.name ?? `http_${response.status}` };
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.name : 'network_error' };
  }
}
