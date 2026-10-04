import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente con la SERVICE ROLE (omite RLS). Uso restringido a:
 * - la Admin API de Auth (crear usuarios, cambiar contraseñas, bloquear), y
 * - resolver el usuario → identificador de acceso en el login.
 * Nunca se expone al navegador y sólo se usa tras verificar al administrador.
 */
function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(serviceKey());
}

export function createAdminClient() {
  const key = serviceKey();
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY (sólo servidor). Revisa .env.local.');
  return createClient<Database>(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
