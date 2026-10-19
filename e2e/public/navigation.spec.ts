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

test('sitemap con la plataforma y la demo; imagen para compartir de un catálogo inexistente responde 404', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toMatch(/<loc>https?:\/\/[^<]+\/demo<\/loc>/);
  expect((await request.get('/og/catalogo/no-existe')).status()).toBe(404);
  expect((await request.get('/og/catalogo/no-existe/p/algo')).status()).toBe(404);
});

test.describe('/api/views (visitas del sitio publicado)', () => {
  test('valida el cuerpo y el origen; una visita válida responde 204 sin revelar si contó', async ({ request }) => {
    expect((await request.post('/api/views', { data: { slug: 'X Y' } })).status()).toBe(400);
    expect((await request.post('/api/views', { data: { slug: 'cafe-aurora', item: '../admin' } })).status()).toBe(400);
    expect((await request.post('/api/views', { headers: { 'content-type': 'application/json' }, data: 'x'.repeat(2000) })).status()).toBe(413);
    expect((await request.post('/api/views', { data: { slug: 'cafe-aurora' }, headers: { origin: 'https://otro-sitio.example' } })).status()).toBe(403);
    expect((await request.post('/api/views', { data: { slug: 'cafe-aurora', item: 'croissant' } })).status()).toBe(204);
  });

  test('la demo no cuenta visitas', async ({ page }) => {
    const beacons: string[] = [];
    page.on('request', (request) => request.url().endsWith('/api/views') && beacons.push(request.url()));
    await page.goto('/demo');
    await page.goto('/demo/p/ejemplo-1');
    await page.waitForTimeout(500);
    expect(beacons).toEqual([]);
  });
});

test.describe('aviso semanal por correo (sin sesión)', () => {
  test('el cron no responde sin el secreto', async ({ request }) => {
    expect((await request.get('/api/cron/catalog-review')).status()).toBe(401);
    expect((await request.get('/api/cron/catalog-review', { headers: { authorization: 'Bearer cualquier-cosa-larga-123' } })).status()).toBe(401);
  });

  test('la baja con un enlace inválido no hace nada', async ({ page, request }) => {
    await page.goto('/baja?token=falso');
    await expect(page.getByRole('heading', { name: 'Este enlace no es válido' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dejar de recibirlo' })).toHaveCount(0);
    expect((await request.post('/api/email/unsubscribe?token=falso', { form: { 'List-Unsubscribe': 'One-Click' } })).status()).toBe(400);
  });
});
