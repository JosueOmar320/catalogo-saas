import { expect, test, type Page } from '@playwright/test';

/** En móvil: sin desplazamiento horizontal y el botón flotante dentro de la pantalla. */
async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test('la landing no se desborda en móvil', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('pedido en móvil: botón flotante visible y panel usable', async ({ page }) => {
  await page.goto('/demo');
  await expectNoHorizontalScroll(page);

  const espresso = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Espresso doble', exact: true }) }).first();
  await espresso.getByRole('button', { name: 'Agregar' }).tap();

  const fab = page.getByRole('button', { name: /^Ver pedido/ });
  await expect(fab).toBeInViewport();
  const box = await fab.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

  await fab.tap();
  const dialog = page.getByRole('dialog', { name: 'Tu pedido' });
  await expect(dialog).toBeInViewport();
  await expect(dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' })).toBeInViewport();
});
