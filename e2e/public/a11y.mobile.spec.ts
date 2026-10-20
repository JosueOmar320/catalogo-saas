import { test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';

test('accesibilidad en móvil: sitio de ejemplo y pedido abierto', async ({ page }) => {
  await page.goto('/demo');
  await expectAccessible(page, '/demo (móvil)');
  await page.locator('article').filter({ hasText: 'Espresso doble' }).first().getByRole('button', { name: /^Agregar/ }).click();
  await page.getByRole('button', { name: /^Ver pedido/ }).click();
  await expectAccessible(page, 'pedido abierto (móvil)');
});
