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

test.describe('/api/orders (aviso de pedido enviado)', () => {
  const valid = { slug: 'cafe-aurora', items: [{ id: '00000000-0000-4000-8000-000000000001', qty: 2 }] };

  test('rechaza cuerpos inválidos o demasiado grandes', async ({ request }) => {
    expect((await request.post('/api/orders', { data: { slug: 'X Y', items: [] } })).status()).toBe(400);
    expect((await request.post('/api/orders', { data: { ...valid, items: [{ id: 'no-uuid', qty: 1 }] } })).status()).toBe(400);
    expect((await request.post('/api/orders', { data: { ...valid, items: [{ ...valid.items[0], qty: 500 }] } })).status()).toBe(400);
    expect((await request.post('/api/orders', { headers: { 'content-type': 'application/json' }, data: 'x'.repeat(9000) })).status()).toBe(413);
  });

  test('rechaza otros orígenes', async ({ request }) => {
    const response = await request.post('/api/orders', { data: valid, headers: { origin: 'https://otro-sitio.example' } });
    expect(response.status()).toBe(403);
  });

  test('un aviso válido responde 204 sin revelar si contó', async ({ request }) => {
    const response = await request.post('/api/orders', { data: valid });
    expect(response.status()).toBe(204);
  });
});
