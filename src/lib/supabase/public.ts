import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/** Tope por consulta: /api/health y el sitemap no pueden quedarse colgados si la base no responde. */
const TIMEOUT_MS = 8_000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
};

/**
 * Cliente anónimo sin cookies para lecturas públicas cacheables.
 * Sólo puede ejecutar get_public_catalog (el rol anon no lee tablas).
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}
