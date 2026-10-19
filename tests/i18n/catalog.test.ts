import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { APP_EN } from '@/i18n/en';
import admin from '@/i18n/en/admin';
import assistant from '@/i18n/en/assistant';
import builder from '@/i18n/en/builder';
import catalog from '@/i18n/en/catalog';
import core from '@/i18n/en/core';
import labels from '@/i18n/en/labels';
import landing from '@/i18n/en/landing';
import pdf from '@/i18n/en/pdf';
import SITE_EN from '@/i18n/en/site';

/**
 * Los textos se marcan en el código con t('…') o msg('…') (el español es la
 * clave). Esta prueba garantiza que el catálogo inglés esté completo y limpio:
 * cada texto marcado tiene traducción, no sobran traducciones y las variables
 * {así} se conservan. Los textos del sitio público van en `en/site.ts`.
 */
const ROOT = join(process.cwd(), 'src');
// Textos que ve el VISITANTE (sitio público y PDF generado): catálogo `en/site.ts`.
// El estudio de PDF (features/pdf/components) es interfaz del panel: catálogo de la app.
const SITE_DIRS = ['site-renderer', join('features', 'pdf')];
// Las Server Actions del estudio (actions.ts) devuelven mensajes del panel: también son de la app.
const APP_INSIDE_SITE_DIRS = [join('features', 'pdf', 'components'), join('features', 'pdf', 'actions.ts')];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'en' && dir.endsWith('i18n') ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const unescape = (raw: string) => raw.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
// Primer argumento literal de t(…), siteT(…) o msg(…). Las plantillas con ${…} no se aceptan como clave.
const CALL = /\b(?:t|siteT|msg)\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;

function extract() {
  const app = new Map<string, string>();
  const site = new Map<string, string>();
  for (const file of files(ROOT)) {
    const rel = relative(ROOT, file);
    const isSite = SITE_DIRS.some((d) => rel.startsWith(d)) && !APP_INSIDE_SITE_DIRS.some((d) => rel.startsWith(d));
    const target = isSite ? site : app;
    for (const match of readFileSync(file, 'utf8').matchAll(CALL)) {
      const key = unescape(match[1] ?? match[2] ?? match[3]);
      if (key.trim()) target.set(key, rel);
    }
  }
  return { app, site };
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n: catálogo inglés', () => {
  const { app, site } = extract();

  it('cada texto de la app tiene traducción', () => {
    const missing = [...app].filter(([key]) => !(key in APP_EN)).map(([key, file]) => `${file}: ${JSON.stringify(key)}`);
    assert.deepEqual(missing, [], `Faltan ${missing.length} traducciones en src/i18n/en/*.ts`);
  });

  it('cada texto del sitio público tiene traducción', () => {
    const missing = [...site].filter(([key]) => !(key in SITE_EN)).map(([key, file]) => `${file}: ${JSON.stringify(key)}`);
    assert.deepEqual(missing, [], `Faltan ${missing.length} traducciones en src/i18n/en/site.ts`);
  });

  it('no sobran traducciones (todas se usan en el código)', () => {
    const unusedApp = Object.keys(APP_EN).filter((key) => !app.has(key));
    const unusedSite = Object.keys(SITE_EN).filter((key) => !site.has(key));
    assert.deepEqual([...unusedApp, ...unusedSite], [], 'Hay traducciones sin uso: bórralas o marca el texto con msg()');
  });

  it('las traducciones conservan las variables {…} y no están vacías', () => {
    const broken = Object.entries({ ...APP_EN, ...SITE_EN }).filter(([key, value]) => !value.trim() || placeholders(key).join() !== placeholders(value).join());
    assert.deepEqual(broken, []);
  });

  it('un mismo texto no tiene dos traducciones distintas entre áreas', () => {
    // El español es la clave: si dos áreas usan la misma palabra con sentidos distintos,
    // una pisaría a la otra en silencio. Hay que cambiar el texto fuente en una de ellas.
    const areas = { core, landing, labels, catalog, builder, pdf, assistant, admin };
    const first = new Map<string, { area: string; value: string }>();
    const conflicts: string[] = [];
    for (const [area, entries] of Object.entries(areas)) {
      for (const [key, value] of Object.entries(entries)) {
        const seen = first.get(key);
        if (!seen) first.set(key, { area, value });
        else if (seen.value !== value) conflicts.push(`${JSON.stringify(key)}: ${seen.area} → ${JSON.stringify(seen.value)} · ${area} → ${JSON.stringify(value)}`);
      }
    }
    assert.deepEqual(conflicts, []);
  });
});
