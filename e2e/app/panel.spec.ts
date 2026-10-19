import { expect, test } from '@playwright/test';
import { unsubscribeToken } from '../../src/lib/email/links';
import { admin, login } from './session';

/**
 * Recorrido completo con sesión, en orden: el administrador crea un negocio,
 * lo administra desde el panel, lo publica y un visitante hace un pedido.
 * La base se reinicia en cada ejecución (scripts/e2e-app.mjs).
 */
test.describe.configure({ mode: 'serial' });

const businessName = `Café E2E ${Date.now().toString(36)}`;
const productName = 'Croissant E2E';
let slug = '';
// Los contextos nuevos heredan la sesión del proyecto: ésta es la de alguien sin cuenta.
const ANONYMOUS = { locale: 'es-MX', storageState: { cookies: [], origins: [] } };

test('el administrador crea un negocio y se asigna como propietario', async ({ page }) => {
  await page.goto('/admin/negocios/nuevo');
  await page.getByLabel('Nombre', { exact: true }).fill(businessName);
  await page.getByLabel('Propietario').click();
  await page.getByRole('option', { name: new RegExp(`^@${admin.username}`) }).click();
  await page.getByLabel('WhatsApp (opcional)').fill('+52 55 1234 5678');
  await page.getByRole('button', { name: 'Crear negocio' }).click();

  await expect(page).toHaveURL(/\/admin\/negocios\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: businessName })).toBeVisible();
  slug = (await page.getByText(/^\/[a-z0-9-]+$/).first().textContent())!.slice(1);
  expect(slug).toMatch(/^cafe-e2e-/);
});

test('el inicio del panel guía al negocio nuevo', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${businessName}` })).toBeVisible();
  await expect(page.getByText('Primeros pasos')).toBeVisible();
  await expect(page.getByText('Aún no tienes productos ni servicios')).toBeVisible();
  await expect(page).toHaveTitle('Inicio · Vitrina');
});

test('un producto sin foto ni precio aparece en "Revisa tu catálogo"', async ({ page }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(productName);
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);

  await page.goto('/dashboard');
  await expect(page.getByText('1 sin foto: las fotos son lo primero que miran tus clientes.')).toBeVisible();
  await expect(page.getByText('1 producto(s) sin precio.')).toBeVisible();
  await expect(page.getByRole('list').getByText(productName)).toBeVisible();

  await page.getByRole('link', { name: 'Revisar: Sin foto' }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/products\?revisar=sin-foto$/);
  await expect(page.getByText('1 de 1')).toBeVisible();
  await expect(page.getByText(productName)).toBeVisible();
});

test('al publicar, el visitante ve el producto y puede pedirlo por WhatsApp', async ({ page, browser }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('button', { name: 'Más opciones de publicación' })).toBeVisible();

  // Visitante: sin sesión.
  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  const response = await site.goto(`/catalogo/${slug}/p/croissant-e2e`);
  expect(response?.status()).toBe(200);
  await expect(site.getByRole('heading', { level: 1, name: productName })).toBeVisible();
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  await site.getByRole('button', { name: /^Ver pedido/ }).click();
  const href = await site.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).getAttribute('href');
  expect(new URL(href!).searchParams.get('text')).toContain(`Hola ${businessName}, quiero hacer este pedido:\n\n• 1 × ${productName} (precio por confirmar)`);

  // Enviar: WhatsApp se intercepta (no sale a internet) y el sitio avisa al servidor.
  await visitor.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'WhatsApp' }));
  const tracked = site.waitForRequest((request) => request.url().endsWith('/api/orders') && request.method() === 'POST');
  const popup = visitor.waitForEvent('page');
  await site.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).click();
  const beacon = await tracked;
  expect(beacon.postDataJSON()).toEqual({ slug, items: [{ id: expect.any(String), qty: 1 }] });
  await (await popup).close();
  await visitor.close();
});

test('el inicio del panel cuenta el pedido enviado', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('main').getByText('Últimos 30 días', { exact: true })).toBeVisible();
  // El aviso del navegador llega en segundo plano: se recarga hasta verlo.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('main').getByRole('term').filter({ hasText: /^Pedidos$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('1', { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  // Dentro de <main>: tras recargar, el streaming puede dejar un instante una copia oculta.
  const main = page.getByRole('main');
  await expect(main.getByText('Lo más pedido', { exact: true })).toBeVisible();
  await expect(main.getByRole('listitem').filter({ hasText: `${productName} · 1 unidad` })).toBeVisible();
});

test('importar productos desde CSV y volver a importarlos actualiza en vez de duplicar', async ({ page }) => {
  const csv = ['nombre;categoria;precio;codigo;destacado', 'Pastel de zanahoria;Postres;65;POS-1;sí', 'Galleta de avena;Postres;1.200,50;POS-2;no'].join('\n');
  const importFile = async () => {
    await page.goto('/dashboard/catalog/products');
    await page.getByRole('button', { name: 'Importar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Importar desde CSV' });
    await dialog.locator('input[type=file]').setInputFiles({ name: 'productos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    return dialog;
  };

  let dialog = await importFile();
  await expect(dialog.getByText('2 nuevos')).toBeVisible();
  await expect(dialog.getByText('0 se actualizan')).toBeVisible();
  await expect(dialog.getByLabel(/Crear las categorías que no existen: Postres/)).toBeChecked();
  await dialog.getByRole('button', { name: 'Importar 2' }).click();
  await expect(page.getByText('Importación lista: 2 nuevos y 0 actualizados.')).toBeVisible();
  await expect(page.getByText('Pastel de zanahoria')).toBeVisible();
  await expect(page.getByText('$1,200.50')).toBeVisible();

  // El mismo archivo otra vez: se reconocen por código.
  dialog = await importFile();
  await expect(dialog.getByText('0 nuevos')).toBeVisible();
  await expect(dialog.getByText('2 se actualizan')).toBeVisible();
  await dialog.getByRole('button', { name: 'Importar 2' }).click();
  await expect(page.getByText('Importación lista: 0 nuevos y 2 actualizados.')).toBeVisible();

  // Exportar trae lo mismo en CSV.
  const exported = await page.request.get('/api/catalog/export');
  expect(exported.headers()['content-type']).toContain('text/csv');
  const text = await exported.text();
  expect(text).toMatch(/^\uFEFFnombre,tipo,categoria,precio/);
  expect(text).toContain('Pastel de zanahoria,producto,Postres,65,,,POS-1');
});

test('acciones masivas: ocultar varios y subir precios con redondeo', async ({ page }) => {
  await page.goto('/dashboard/catalog/products');
  await page.getByRole('checkbox', { name: 'Seleccionar Pastel de zanahoria' }).check();
  await page.getByRole('checkbox', { name: 'Seleccionar Galleta de avena' }).check();
  const toolbar = page.getByRole('toolbar', { name: 'Acciones para los ítems seleccionados' });
  await expect(toolbar.getByText('2 seleccionados')).toBeVisible();

  await toolbar.getByRole('button', { name: 'Visibilidad' }).click();
  await page.getByRole('menuitem', { name: 'Ocultar del catálogo' }).click();
  await expect(page.getByText('2 ítems actualizados')).toBeVisible();
  await expect(toolbar).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Pastel de zanahoria' }).getByRole('switch')).not.toBeChecked();

  await page.getByRole('checkbox', { name: 'Seleccionar Pastel de zanahoria' }).check();
  await page.getByRole('toolbar').getByRole('button', { name: 'Precios' }).click();
  const prices = page.getByRole('dialog', { name: 'Ajustar precios' });
  await prices.getByLabel('Porcentaje').fill('10');
  await prices.getByLabel('Redondeo').selectOption('unit');
  await expect(prices.getByText('$72')).toBeVisible(); // 65 + 10 % = 71.5 → 72
  await prices.getByRole('button', { name: 'Ajustar 1 precio' }).click();
  await expect(page.getByText('1 ítem actualizado')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Pastel de zanahoria' }).getByText('$72')).toBeVisible();
});

test('búsqueda rápida (Ctrl+K) y código QR del catálogo', async ({ page }) => {
  await page.goto('/dashboard');
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: 'Buscar' });
  await search.fill('zanahoria');
  await expect(page.getByRole('option', { name: /Pastel de zanahoria/ })).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Código QR' }).click();
  const qr = page.getByRole('dialog', { name: 'Código QR de tu catálogo' });
  await expect(qr.getByRole('img', { name: new RegExp(`Código QR que abre .*/catalogo/${slug}`) })).toBeVisible();
  const download = page.waitForEvent('download');
  await qr.getByRole('button', { name: 'PNG' }).click();
  expect((await download).suggestedFilename()).toBe(`qr-${slug}.png`);
});

test('aviso semanal: a quién le llega y la baja con el enlace del correo', async ({ page, browser, request }) => {
  const cron = async () => {
    const response = await request.get('/api/cron/catalog-review?dry=1', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(response.status()).toBe(200);
    return response.json();
  };
  expect((await request.get('/api/cron/catalog-review')).status()).toBe(401);
  expect((await request.get('/api/cron/catalog-review', { headers: { authorization: 'Bearer incorrecto-pero-largo-123' } })).status()).toBe(401);

  // Sin email de contacto nadie lo recibe (aunque el negocio tenga pendientes).
  expect(await cron()).toMatchObject({ dryRun: true, candidates: 0, due: 0 });

  // El admin agrega su email de contacto.
  await page.goto('/admin/usuarios');
  await page.getByRole('row', { name: new RegExp(`@${admin.username}`) }).click();
  await expect(page).toHaveURL(/\/admin\/usuarios\/[0-9a-f-]{36}$/);
  const userId = page.url().split('/').pop()!;
  await page.getByLabel('Email (opcional)').fill('e2e-admin@example.com');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Usuario guardado')).toBeVisible();
  // Producto sin foto ni precio → le corresponde el aviso (modo de prueba: no se envía).
  expect(await cron()).toMatchObject({ dryRun: true, candidates: 1, due: 1, sent: 0 });

  // Baja desde el enlace del correo, sin sesión: visitar no cambia nada; hay que confirmar.
  const visitor = await browser.newContext(ANONYMOUS);
  const mail = await visitor.newPage();
  await mail.goto(`/baja?token=${encodeURIComponent(unsubscribeToken(userId, process.env.CRON_SECRET!))}`);
  await expect(mail.getByRole('heading', { name: '¿Dejar de recibir el aviso semanal?' })).toBeVisible();
  expect(await cron()).toMatchObject({ due: 1 });
  await mail.getByRole('button', { name: 'Dejar de recibirlo' }).click();
  await expect(mail.getByRole('heading', { name: 'Listo, ya no recibirás el aviso semanal' })).toBeVisible();
  expect(await cron()).toMatchObject({ candidates: 0, due: 0 });

  // Un enlace manipulado no sirve.
  await mail.goto(`/baja?token=${encodeURIComponent(unsubscribeToken('aaaaaaaa-0000-4000-8000-000000000001', process.env.CRON_SECRET!))}x`);
  await expect(mail.getByRole('heading', { name: 'Este enlace no es válido' })).toBeVisible();
  await visitor.close();

  // Se reactiva en Mi cuenta.
  await page.goto('/cuenta');
  const toggle = page.getByRole('switch', { name: /Aviso semanal de mi catálogo/ });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText('Aviso semanal activado')).toBeVisible();
  expect(await cron()).toMatchObject({ due: 1 });
});

test('el idioma elegido se guarda en el perfil y vuelve al iniciar sesión', async ({ page, browser }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Cambiar idioma' }).click();
  await page.getByRole('menuitem', { name: /English/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Hi, ${businessName}` })).toBeVisible();

  // Otro navegador, en español y sin cookies: al entrar se aplica el idioma del perfil.
  const other = await browser.newContext(ANONYMOUS);
  const fresh = await other.newPage();
  await login(fresh, admin.username, admin.password);
  await expect(fresh).toHaveURL(/\/admin$/);
  await expect(fresh.getByRole('heading', { level: 1, name: 'Admin' })).toBeVisible();
  await expect(fresh.locator('html')).toHaveAttribute('lang', 'en');
  await other.close();
});

test.describe('sin sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('una contraseña incorrecta muestra un error genérico', async ({ page }) => {
    await login(page, admin.username, 'contraseña-incorrecta');
    await expect(page.getByText('Usuario o contraseña incorrectos.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('el panel pide iniciar sesión y regresa a donde ibas', async ({ page }) => {
    await page.goto('/dashboard/catalog/products');
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fcatalog%2Fproducts$/);
    await page.getByLabel('Nombre de usuario').fill(admin.username);
    await page.getByLabel('Contraseña', { exact: true }).fill(admin.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/dashboard\/catalog\/products$/);
  });
});
