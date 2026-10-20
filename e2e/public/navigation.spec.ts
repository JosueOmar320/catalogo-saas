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

test.describe('reseñas de clientes', () => {
  test('la ficha muestra el promedio y las opiniones; la tarjeta, sus estrellas; la demo simula el envío', async ({ page }) => {
    await page.goto('/demo/menu');
    const card = page.getByRole('main').getByRole('article').filter({ hasText: 'Latte de avena' }).first();
    await expect(card.getByLabel('4.5 de 5 estrellas, 2 opiniones')).toBeVisible();

    await page.goto('/demo/p/ejemplo-2');
    const reviews = page.getByRole('region', { name: 'Opiniones' });
    await expect(reviews.getByText('2 opiniones')).toBeVisible();
    await expect(reviews.getByText('Luis R.')).toBeVisible();
    await expect(reviews.getByText('Muy rico, aunque me gusta un poco más caliente.')).toBeVisible();

    await reviews.getByRole('button', { name: 'Deja tu opinión' }).click();
    const send = reviews.getByRole('button', { name: 'Enviar opinión' });
    await expect(send).toBeDisabled();
    await reviews.getByRole('radio', { name: '5 de 5 estrellas' }).check();
    await reviews.getByLabel('Tu nombre').fill('Ana');
    await reviews.getByLabel('Comentario (opcional)').fill('¡Delicioso!');
    await send.click();
    await expect(reviews.getByRole('status')).toHaveText('¡Gracias! Tu opinión se publicará cuando el negocio la apruebe.');
  });

  test('un producto sin opiniones invita a dejar la primera', async ({ page }) => {
    await page.goto('/demo/p/ejemplo-1');
    await expect(page.getByRole('region', { name: 'Opiniones' }).getByText('Todavía no hay opiniones. ¡Sé el primero!')).toBeVisible();
  });

  test('/api/reviews valida el cuerpo, el tamaño y el origen; el campo trampa no guarda nada', async ({ request }) => {
    const valid = { slug: 'cafe-aurora', item: 'latte', name: 'Ana', rating: 5, body: 'Rico' };
    expect((await request.post('/api/reviews', { data: { ...valid, rating: 6 } })).status()).toBe(400);
    expect((await request.post('/api/reviews', { data: { ...valid, name: '  ' } })).status()).toBe(400);
    expect((await request.post('/api/reviews', { data: { ...valid, item: '../admin' } })).status()).toBe(400);
    expect((await request.post('/api/reviews', { data: { ...valid, body: 'x'.repeat(601) } })).status()).toBe(400);
    expect((await request.post('/api/reviews', { headers: { 'content-type': 'application/json' }, data: 'x'.repeat(5000) })).status()).toBe(413);
    expect((await request.post('/api/reviews', { data: valid, headers: { origin: 'https://otro-sitio.example' } })).status()).toBe(403);
    const bot = await request.post('/api/reviews', { data: { ...valid, website: 'https://spam.example' } });
    expect(bot.status()).toBe(200);
    expect(await bot.json()).toEqual({ ok: true });
  });
});

test('favoritos: se guardan con el corazón, filtran el catálogo y se recuerdan', async ({ page }) => {
  await page.goto('/demo/menu');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: /^Favoritos/ })).toHaveCount(0);
  await main.getByRole('button', { name: 'Guardar Latte de avena en favoritos' }).first().click();
  await expect(main.getByRole('button', { name: 'Quitar Latte de avena de favoritos' }).first()).toHaveAttribute('aria-pressed', 'true');
  const chip = main.getByRole('button', { name: 'Favoritos (1)' });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(main.getByRole('article')).toHaveCount(1);
  await expect(main.getByRole('article').getByRole('heading', { name: 'Latte de avena' })).toBeVisible();

  await page.reload();
  await expect(main.getByRole('button', { name: 'Favoritos (1)' })).toBeVisible();
  await page.goto('/demo/p/ejemplo-2');
  const detail = page.getByRole('button', { name: 'Quitar Latte de avena de favoritos' });
  await expect(detail).toHaveText('En tus favoritos');
  await detail.click();
  await expect(page.getByRole('button', { name: 'Guardar Latte de avena en favoritos' })).toHaveText('Guardar');
  await page.goto('/demo/menu');
  await expect(main.getByRole('article').first()).toBeVisible();
  await expect(main.getByRole('button', { name: /^Favoritos/ })).toHaveCount(0);
});

test('«Combínalo con»: la ficha sugiere lo que eligió el negocio', async ({ page }) => {
  await page.goto('/demo/p/ejemplo-2');
  const pairs = page.getByRole('region', { name: 'Combínalo con' });
  await expect(pairs.getByRole('article')).toHaveCount(2);
  await expect(pairs.getByRole('heading', { name: 'Croissant de mantequilla' })).toBeVisible();
  await expect(pairs.getByRole('heading', { name: 'Pan de masa madre' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'También te puede interesar' })).toHaveCount(0);
});

test.describe('/api/search-misses (búsquedas sin resultados)', () => {
  test('valida el cuerpo, el tamaño y el origen; lo que parece un dato personal no se guarda', async ({ request }) => {
    expect((await request.post('/api/search-misses', { data: { slug: 'X Y', term: 'pastel' } })).status()).toBe(400);
    expect((await request.post('/api/search-misses', { data: { slug: 'cafe-aurora', term: 'ab' } })).status()).toBe(400);
    expect((await request.post('/api/search-misses', { headers: { 'content-type': 'application/json' }, data: 'x'.repeat(800) })).status()).toBe(413);
    expect((await request.post('/api/search-misses', { data: { slug: 'cafe-aurora', term: 'pastel' }, headers: { origin: 'https://otro-sitio.example' } })).status()).toBe(403);
    expect((await request.post('/api/search-misses', { data: { slug: 'cafe-aurora', term: 'ana@correo.mx' } })).status()).toBe(204);
    expect((await request.post('/api/search-misses', { data: { slug: 'cafe-aurora', term: 'pastel' } })).status()).toBe(204);
  });

  test('la demo no cuenta búsquedas', async ({ page }) => {
    const beacons: string[] = [];
    page.on('request', (request) => request.url().endsWith('/api/search-misses') && beacons.push(request.url()));
    await page.goto('/demo/menu');
    await page.getByRole('searchbox').fill('pastel de chocolate');
    await expect(page.getByText('Sin resultados')).toBeVisible();
    await page.waitForTimeout(2000);
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
