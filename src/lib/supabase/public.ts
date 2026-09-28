import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente anónimo sin cookies para lecturas públicas cacheables.
 * Sólo puede ejecutar get_public_catalog (el rol anon no lee tablas).
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
