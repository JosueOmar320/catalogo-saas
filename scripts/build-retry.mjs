/**
 * `next build` que reintenta SÓLO cuando falla la descarga de Google Fonts
 * (next/font/google). En CI, muchos builds a la vez (p. ej. al actualizar
 * varios PRs) a veces reciben errores de fonts.gstatic.com y Turbopack lo
 * reporta como "Module not found: …/internal/font/google/font". Cualquier
 * otro error falla de inmediato, sin reintentar.
 *
 *   npm run build:retry
 */
import { spawn } from 'node:child_process';

const ATTEMPTS = 3;
const FONT_ERROR = /internal\/font\/google|fonts\.(googleapis|gstatic)\.com|Failed to fetch font/i;

function build() {
  return new Promise((resolve) => {
    const child = spawn('npx', ['next', 'build'], { stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output += chunk;
    });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

for (let attempt = 1; ; attempt++) {
  const { code, output } = await build();
  if (code === 0) process.exit(0);
  if (attempt >= ATTEMPTS || !FONT_ERROR.test(output)) process.exit(code);
  const seconds = attempt * 20;
  console.error(`\n[build] Falló la descarga de fuentes de Google: reintento ${attempt + 1} de ${ATTEMPTS} en ${seconds} s…\n`);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
