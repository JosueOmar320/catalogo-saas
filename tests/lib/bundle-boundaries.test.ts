import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

/**
 * El sitio público no debe cargar zod en el navegador (README: "El bundle del
 * sitio público no incluye Zod"). Se recorre el grafo de imports (sólo los de
 * valor; los `import type` se borran al compilar) desde cada componente
 * cliente de site-renderer y se exige que ninguno llegue a 'zod'. Los módulos
 * 'use server' se detienen: en el cliente son referencias, no código.
 */
const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'src');

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function valueImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  if (/^\s*['"]use server['"]/m.test(source.slice(0, 200))) return [];
  const specs: string[] = [];
  for (const match of source.matchAll(/^import\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) if (!match[1]) specs.push(match[2]);
  for (const match of source.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) specs.push(match[1]);
  for (const match of source.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) specs.push(match[1]);
  return specs;
}

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Primera ruta de imports desde `start` hasta el paquete `target`, o null. */
function pathTo(start: string, target: string): string[] | null {
  const seen = new Set<string>();
  const stack: [string, string[]][] = [[start, [start]]];
  while (stack.length) {
    const [file, trail] = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of valueImports(file)) {
      if (spec === target) return trail;
      const next = resolveImport(file, spec);
      if (next && !seen.has(next)) stack.push([next, [...trail, next]]);
    }
  }
  return null;
}

const relative = (files: string[]) => files.map((f) => path.relative(ROOT, f)).join(' -> ');

describe('Límites del bundle del sitio público', () => {
  const clientFiles = listFiles(path.join(SRC, 'site-renderer')).filter((file) => /^\s*['"]use client['"]/m.test(fs.readFileSync(file, 'utf8').slice(0, 200)));

  it('hay componentes cliente en site-renderer', () => {
    assert.ok(clientFiles.length >= 5);
  });

  for (const file of clientFiles) {
    it(`${path.relative(ROOT, file)} no llega a zod`, () => {
      const trail = pathTo(file, 'zod');
      assert.equal(trail, null, trail ? `zod se carga vía: ${relative(trail)}` : undefined);
    });
  }

  it('los módulos *-core no importan zod', () => {
    for (const file of listFiles(SRC).filter((f) => /-core\.tsx?$/.test(f))) {
      const trail = pathTo(file, 'zod');
      assert.equal(trail, null, trail ? `zod se carga vía: ${relative(trail)}` : undefined);
    }
  });

  it('site-renderer no importa features/*', () => {
    for (const file of listFiles(path.join(SRC, 'site-renderer'))) {
      for (const spec of valueImports(file)) assert.ok(!spec.startsWith('@/features/'), `${path.relative(ROOT, file)} importa ${spec}`);
    }
  });

  // Capas: lib es la base; lo que comparten el sitio y el panel vive ahí (p. ej. lib/orders/payment-labels), no al revés.
  it('lib no importa site-renderer ni features/*', () => {
    for (const file of listFiles(path.join(SRC, 'lib'))) {
      for (const spec of valueImports(file)) assert.ok(!spec.startsWith('@/site-renderer') && !spec.startsWith('@/features/'), `${path.relative(ROOT, file)} importa ${spec}`);
    }
  });
});
