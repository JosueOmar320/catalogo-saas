import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas end-to-end (navegador real) sobre el build de producción.
 *
 *   npm run test:e2e          → compila, levanta `next start` en el puerto 3100 y prueba
 *   E2E_BASE_URL=http://… npm run test:e2e   → prueba un servidor ya levantado
 *
 * Las de e2e/public no necesitan Supabase (landing, demo, pedido por WhatsApp):
 * corren igual en CI sin secretos.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

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
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /\.mobile\.spec\.ts$/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /\.mobile\.spec\.ts$/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: baseURL,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
