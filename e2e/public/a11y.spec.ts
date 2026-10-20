import { test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';

/** Accesibilidad (axe) de la landing, el sitio de ejemplo y sus estados interactivos. */
test.describe('Accesibilidad del sitio público', () => {
  for (const path of ['/', '/demo', '/demo/menu', '/demo/p/ejemplo-2', '/demo/pedido-rapido', '/demo/eventos', '/demo/nosotros', '/demo/contacto', '/login']) {
    test(`sin problemas en ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page, path);
    });
  }

  test('sin problemas con los filtros, el pedido, el formulario de opinión y la foto en grande abiertos', async ({ page }) => {
    await page.goto('/demo/menu');
    await page.getByRole('button', { name: 'Filtros' }).click();
    await expectAccessible(page, 'filtros');

    await page.goto('/demo');
    await page.locator('article').filter({ hasText: 'Espresso doble' }).first().getByRole('button', { name: 'Agregar al pedido' }).click();
    await page.getByRole('button', { name: /^Ver pedido/ }).click();
    await expectAccessible(page, 'pedido abierto');

    await page.goto('/demo/p/ejemplo-2');
    await page.getByRole('button', { name: 'Deja tu opinión' }).click();
    await expectAccessible(page, 'formulario de opinión');
    await page.getByRole('button', { name: 'Ver la imagen de Latte de avena en grande' }).click();
    await expectAccessible(page, 'foto en grande');
  });
});
