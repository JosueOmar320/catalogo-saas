import 'server-only';

/**
 * Límite simple por usuario (ventana deslizante, en memoria de la instancia).
 * Suficiente para evitar abusos accidentales; para varias instancias usar
 * Redis/Upstash con la misma interfaz.
 */
const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return { ok: true, retryAfter: 0 };
}
