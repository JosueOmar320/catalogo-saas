import { expect, test } from '@playwright/test';

test('el panel sin sesión lleva al login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByLabel('Nombre de usuario')).toBeVisible();
});

test('una página inexistente responde 404 con enlace de regreso', async ({ page }) => {
  const response = await page.goto('/no-existe-esta-pagina');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link').first()).toBeVisible();
});

test('un catálogo inexistente responde 404', async ({ page }) => {
  const response = await page.goto('/catalogo/no-existe-este-negocio');
  expect(response?.status()).toBe(404);
});
