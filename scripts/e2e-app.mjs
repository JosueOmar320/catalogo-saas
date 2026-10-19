/**
 * Pruebas end-to-end CON SESIÓN (login, admin, panel, sitio publicado).
 *
 *   npm run test:e2e:app                 (requiere Docker)
 *   npm run test:e2e:app -- --headed     (argumentos extra van a Playwright)
 *
 * 1. Levanta Supabase LOCAL en Docker (supabase/config.toml) o reutiliza el que
 *    ya esté corriendo, y reinicia su base (migraciones desde cero): cada
 *    ejecución parte de un estado limpio y conocido.
 * 2. Crea el administrador de prueba con una contraseña aleatoria de esta
 *    ejecución (no se guarda en ningún lado).
 * 3. Corre los proyectos "app" de Playwright contra un build que apunta a ese
 *    Supabase local. Las variables se pasan explícitas para que NUNCA se usen
 *    las de .env.local (los proyectos de la nube no se tocan).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const CLI = ['-y', 'supabase@2.121.0'];
// Sólo base de datos, auth, API (PostgREST + Kong) y storage.
const EXCLUDE = 'imgproxy,postgres-meta,supavisor,vector,logflare,mailpit,studio,edge-runtime,realtime';
const PORT = process.env.E2E_PORT ?? '3200';

const supabase = (args, stdio = 'inherit') => execFileSync('npx', [...CLI, ...args], { stdio: ['ignore', stdio, 'inherit'], encoding: 'utf8' });

function status() {
  try {
    return JSON.parse(supabase(['status', '-o', 'json'], 'pipe'));
  } catch {
    return null;
  }
}

let local = status();
if (!local?.API_URL) {
  console.log('Levantando Supabase local (la primera vez descarga las imágenes de Docker)…');
  supabase(['start', '-x', EXCLUDE]);
  local = status();
}
// Siempre desde cero: `supabase stop` conserva los datos, y un usuario de una
// ejecución anterior tendría otra contraseña.
console.log('Reiniciando la base local (migraciones desde cero)…');
supabase(['db', 'reset']);
if (!local?.API_URL || !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(local.API_URL)) {
  console.error('No se encontró un Supabase LOCAL. Las pruebas con sesión sólo corren contra 127.0.0.1.');
  process.exit(1);
}

const username = 'e2e-admin';
const password = randomBytes(18).toString('base64url');
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: local.SECRET_KEY,
  SUPABASE_SECRET_KEY: local.SECRET_KEY,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  AUTH_USERNAME_DOMAIN: 'usuarios.invalid',
  // Aviso semanal: secreto propio de esta ejecución y sin Resend (modo de prueba, nunca envía correos).
  CRON_SECRET: randomBytes(24).toString('base64url'),
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  // Garfield en modo básico: sin llamadas a proveedores de IA.
  ASSISTANT_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  GEMINI_API_KEY: '',
  E2E_APP: '1',
  E2E_PORT: PORT,
  E2E_ADMIN_USERNAME: username,
  E2E_ADMIN_PASSWORD: password,
};

execFileSync('node', ['scripts/create-admin.mjs', '--username', username, '--password', password, '--name', 'Admin E2E'], { env, stdio: 'inherit' });

const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
