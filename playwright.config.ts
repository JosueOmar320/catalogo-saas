import { defineConfig, devices } from '@playwright/test';
import { ADMIN_STATE } from './e2e/app/session';

/**
 * Pruebas end-to-end (navegador real) sobre el build de producción.
 *
 *   npm run test:e2e          → compila, levanta `next start` en el puerto 3100 y prueba
 *   E2E_BASE_URL=http://… npm run test:e2e   → prueba un servidor ya levantado
 *
 * Las de e2e/public no necesitan Supabase (landing, demo, pedido por WhatsApp):
 * corren igual en CI sin secretos.
 *
 * Las de e2e/app (login, admin, panel, sitio publicado) necesitan sesión:
 * corren con `npm run test:e2e:app`, que levanta Supabase LOCAL en Docker y
 * define E2E_APP=1 (ver scripts/e2e-app.mjs).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const APP = process.env.E2E_APP === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    // El español es el idioma por defecto; las pruebas en inglés lo cambian con test.use().
    locale: 'es-MX',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: APP
    ? [
        { name: 'app-setup', testMatch: /app\/.*\.setup\.ts$/ },
        // Sin reintentos: las pruebas con sesión van en serie sobre un mismo negocio. Un reintento
        // repite el archivo y crea otro negocio, y las siguientes fallan por eso (no por el error real).
        { name: 'app', testMatch: /app\/.*\.spec\.ts$/, dependencies: ['app-setup'], retries: 0, use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE } },
      ]
    : [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /public\/.*(?<!\.mobile)\.spec\.ts$/ },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /public\/.*\.mobile\.spec\.ts$/ },
      ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // build:retry: reintenta si falla la descarga de Google Fonts (pasa en CI con muchos builds a la vez).
        command: `npm run build:retry && npx next start -p ${PORT}`,
        url: baseURL,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
