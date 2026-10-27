import { test as base, type Page } from '@playwright/test';

/**
 * Con streaming, React manda el contenido nuevo dentro de un <div hidden id="S:…">
 * y luego lo mueve a su lugar. Si una prueba busca un texto justo en ese momento,
 * lo encuentra dos veces (la copia oculta y la visible) y falla por «strict mode».
 * Cada `goto` espera a que no quede ningún bloque oculto de streaming.
 */
const STREAMING = 'div[hidden][id^="S:"]';

export async function waitForStreaming(page: Page) {
  // Si algo queda colgado, la prueba sigue y falla con su propio error (no con éste).
  await page.waitForFunction((selector) => !document.querySelector(selector), STREAMING, { timeout: 15_000 }).catch(() => undefined);
}

type Goto = Page['goto'];
const PATCHED = Symbol('waitsForStreaming');

export const test = base.extend<{ settledNavigation: void }>({
  // Automático: también para las páginas que abren las pruebas con browser.newContext() (el visitante).
  settledNavigation: [
    async ({ page }, use) => {
      const proto = Object.getPrototypeOf(page) as { goto: Goto; [PATCHED]?: boolean };
      if (!proto[PATCHED]) {
        const goto = proto.goto;
        proto.goto = async function (this: Page, ...args: Parameters<Goto>) {
          const response = await goto.apply(this, args);
          await waitForStreaming(this);
          return response;
        };
        proto[PATCHED] = true;
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
