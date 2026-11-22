/**
 * Servidor de desarrollo contra el Supabase LOCAL (Docker), sin tocar los
 * proyectos de la nube ni leer sus claves de .env.local.
 *
 *   npx supabase start              (una vez; o `npm run test:e2e:app`, que lo levanta)
 *   npm run dev:local               → `next dev` en http://localhost:3200
 *   npm run dev:local -- --start    → `next build` + `next start` (build de producción;
 *                                     sirve cuando ya hay otro `next dev` corriendo)
 *
 * Toma la URL y las claves de `supabase status`, exige que sea 127.0.0.1 y
 * arranca Next en el puerto 3200 con esas variables. Garfield queda en modo
 * básico y el aviso por correo en modo de prueba (no se envía nada).
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const CLI = ['-y', 'supabase@2.121.0'];
const PORT = process.env.DEV_LOCAL_PORT ?? '3200';

let status;
try {
  const raw = execFileSync('npx', [...CLI, 'status', '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  status = JSON.parse(raw.slice(raw.indexOf('{')));
} catch {
  status = null;
}
if (!status?.API_URL || !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(status.API_URL)) {
  console.error('No hay un Supabase LOCAL corriendo. Levántalo con `npx supabase start` (requiere Docker).');
  process.exit(1);
}

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  AUTH_USERNAME_DOMAIN: 'usuarios.invalid',
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  ASSISTANT_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  GEMINI_API_KEY: '',
};

const production = process.argv.includes('--start');
if (production) {
  const build = spawnSync('npx', ['next', 'build'], { env, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const child = spawn('npx', ['next', production ? 'start' : 'dev', '-p', PORT], { env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
