import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configWarnings } from '@/instrumentation';

describe('Avisos de configuración al arrancar', () => {
  it('sin variables no avisa nada', () => {
    assert.deepEqual(configWarnings({}), []);
  });

  it('en producción avisa si el host canónico no coincide con el dominio de producción de Vercel', () => {
    const warnings = configWarnings({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://vitrina.app', VERCEL_PROJECT_PRODUCTION_URL: 'catalogo-saas-nu.vercel.app' });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /NEXT_PUBLIC_SITE_URL \(vitrina\.app\) no coincide con VERCEL_PROJECT_PRODUCTION_URL \(catalogo-saas-nu\.vercel\.app\)/);
  });

  it('coincidencia (sin importar mayúsculas ni la ruta) o fuera de producción: sin aviso', () => {
    assert.deepEqual(configWarnings({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://Vitrina.app/', VERCEL_PROJECT_PRODUCTION_URL: 'vitrina.app' }), []);
    assert.deepEqual(configWarnings({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SITE_URL: 'https://vitrina.app', VERCEL_PROJECT_PRODUCTION_URL: 'rama.vercel.app' }), []);
    // En local ninguna de las dos existe.
    assert.deepEqual(configWarnings({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://vitrina.app' }), []);
    assert.deepEqual(configWarnings({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'vitrina.app' }), []);
  });

  it('los demás avisos siguen igual', () => {
    const warnings = configWarnings({ CRON_SECRET: 'corto', ASSISTANT_ROUTING: 'raro', EMAIL_FROM: 'x@y.z', NEXT_PUBLIC_SITE_URL: 'vitrina.app' });
    assert.equal(warnings.length, 4);
    assert.match(warnings[0], /CRON_SECRET/);
    assert.match(warnings[3], /URL http\(s\) completa/);
  });
});
