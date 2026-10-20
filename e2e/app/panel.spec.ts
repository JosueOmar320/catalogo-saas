import { expect, test } from '@playwright/test';
import sharp from 'sharp';
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
  // Dentro de <main>: mientras llega el streaming puede haber una copia oculta del contenido.
  const main = page.getByRole('main');
  // Primera visita al inicio: en CI el servidor puede tardar más en responder.
  await expect(main.getByRole('heading', { level: 1, name: `Hola, ${businessName}` })).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText('Primeros pasos')).toBeVisible();
  await expect(main.getByText('Aún no tienes productos ni servicios')).toBeVisible();
  await expect(page).toHaveTitle('Inicio · Vitrina');
});

test('un producto sin foto ni precio aparece en "Revisa tu catálogo"', async ({ page }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(productName);
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);

  await page.goto('/dashboard');
  const main = page.getByRole('main');
  await expect(main.getByText('1 sin foto: las fotos son lo primero que miran tus clientes.')).toBeVisible();
  await expect(main.getByText('1 producto(s) sin precio.')).toBeVisible();
  await expect(main.getByRole('list').getByText(productName)).toBeVisible();

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
  await expect(page.getByRole('main').getByText('Pedidos por WhatsApp', { exact: true })).toBeVisible();
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

test('el inicio del panel cuenta las visitas del sitio publicado y lo más visto', async ({ page, browser }) => {
  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  // El aviso es un sendBeacon: se espera la respuesta del servidor (ya contó) antes de mirar el panel.
  const counted = site.waitForResponse((response) => response.url().endsWith('/api/views') && response.status() === 204);
  await site.goto(`/catalogo/${slug}/p/croissant-e2e`);
  await counted;
  await visitor.close();

  await expect(async () => {
    await page.goto('/dashboard');
    const card = page.getByRole('main').getByText('Visitas a tu sitio', { exact: true });
    await expect(card).toBeVisible({ timeout: 1000 });
    await expect(page.getByRole('main').getByRole('listitem').filter({ hasText: new RegExp(`${productName} · \\d+ visitas?`) })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
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

test('un producto con opciones muestra "desde" y el visitante elige la opción', async ({ page, browser }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Smoothie E2E');
  await page.getByRole('textbox', { name: 'Precio', exact: true }).fill('50');
  await page.getByRole('switch', { name: /Tiene opciones/ }).click();
  await page.getByRole('button', { name: 'Tamaño', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '¿Qué eligen?' })).toHaveValue('Tamaño');
  const options = page.getByRole('list', { name: 'Opciones' }).getByRole('listitem');
  await expect(options).toHaveCount(2);
  await options.nth(0).getByRole('textbox', { name: 'Opción' }).fill('Chico');
  await options.nth(1).getByRole('textbox', { name: 'Opción' }).fill('Grande');
  await options.nth(1).getByRole('textbox', { name: 'Precio' }).fill('70');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('list', { name: 'Opciones' }).getByRole('listitem')).toHaveCount(2);

  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  await site.goto(`/catalogo/${slug}/p/smoothie-e2e`);
  await expect(site.getByRole('heading', { level: 1, name: 'Smoothie E2E' })).toBeVisible();
  await expect(site.getByText('desde', { exact: true }).first()).toBeVisible();
  await site.getByRole('radio', { name: 'Grande' }).click();
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  await site.getByRole('button', { name: /^Ver pedido/ }).click();
  const href = await site.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).getAttribute('href');
  expect(new URL(href!).searchParams.get('text')).toContain('• 1 × Smoothie E2E (Grande) — $70');
  await visitor.close();
});

test('extras y horario de un producto creados en el panel se ven en la ficha publicada', async ({ page, browser }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Bowl E2E');
  await page.getByRole('textbox', { name: 'Precio', exact: true }).fill('80');
  await page.getByRole('switch', { name: /Tiene extras/ }).click();
  await page.getByRole('textbox', { name: 'Título' }).fill('Toppings');
  const extras = page.getByRole('list', { name: 'Extras' }).getByRole('listitem');
  await extras.nth(0).getByRole('textbox', { name: 'Extra' }).fill('Granola');
  await extras.nth(0).getByRole('textbox', { name: 'Precio' }).fill('10');
  await extras.nth(1).getByRole('textbox', { name: 'Extra' }).fill('Miel');
  await page.getByRole('switch', { name: /Sólo en un horario/ }).click();
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);

  const visitor = await browser.newContext({ ...ANONYMOUS, timezoneId: 'UTC' });
  const site = await visitor.newPage();
  // 9:00 en la zona del visitante (el negocio no tiene horario por día): dentro de 7:00–12:00.
  await site.clock.setFixedTime(new Date('2026-10-19T09:00:00Z'));
  await site.goto(`/catalogo/${slug}/p/bowl-e2e`);
  await expect(site.getByText('Se pide de 7:00 a 12:00')).toBeVisible();
  await site.getByRole('group', { name: /Toppings/ }).getByRole('checkbox', { name: /Granola/ }).check();
  await site.getByRole('group', { name: /Toppings/ }).getByRole('checkbox', { name: /Miel/ }).check();
  await expect(site.getByText('$90', { exact: true })).toBeVisible();
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  await expect(site.getByRole('group', { name: 'Cantidad de Bowl E2E + Granola, Miel' })).toBeVisible();
  await visitor.close();
});

test('compartir y buscadores: imagen generada, datos estructurados y sitemap del catálogo publicado', async ({ browser }) => {
  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  await site.goto(`/catalogo/${slug}/p/smoothie-e2e`);
  const og = await site.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(new RegExp(`/og/catalogo/${slug}/p/smoothie-e2e$`));
  const image = await site.request.get(og!);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');

  const ld = JSON.parse((await site.locator('script[type="application/ld+json"]').first().textContent())!);
  expect(ld[0].offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 50, highPrice: 70 });
  expect(ld[1]['@type']).toBe('BreadcrumbList');

  await site.goto(`/catalogo/${slug}`);
  const catalogOg = await site.locator('meta[property="og:image"]').getAttribute('content');
  expect(catalogOg).toMatch(new RegExp(`/og/catalogo/${slug}$`));
  expect((await site.request.get(catalogOg!)).headers()['content-type']).toContain('image/png');

  const sitemap = await (await site.request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(`/catalogo/${slug}</loc>`);
  expect(sitemap).toContain(`/catalogo/${slug}/p/smoothie-e2e</loc>`);
  await visitor.close();
});

test('entrega, pedido mínimo, pago y horario configurados en el panel llegan al pedido del visitante', async ({ page, browser }) => {
  await page.goto('/dashboard/settings/contacto');
  await page.getByRole('switch', { name: /Horario por día/ }).click();
  await expect(page.getByRole('combobox', { name: 'Zona horaria' })).not.toHaveValue('');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('Contacto guardado')).toBeVisible();

  await page.getByRole('switch', { name: /Envío a domicilio/ }).click();
  await page.getByRole('textbox', { name: 'Costo de envío' }).fill('25');
  await page.getByRole('textbox', { name: 'Pedido mínimo' }).fill('100');
  await page.getByRole('checkbox', { name: 'Efectivo' }).check();
  await page.getByRole('button', { name: 'Agregar cupón' }).click();
  await page.getByRole('list', { name: 'Cupones de descuento' }).getByRole('textbox', { name: 'Código' }).fill('e2e10');
  await page.getByRole('button', { name: 'Guardar pedidos' }).click();
  await expect(page.getByText('Configuración guardada')).toBeVisible();

  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  // Datos para buscadores con el horario.
  const home = await (await site.request.get(`/catalogo/${slug}`)).text();
  expect(home).toContain('OpeningHoursSpecification');

  await site.goto(`/catalogo/${slug}/p/smoothie-e2e`);
  await site.getByRole('radio', { name: 'Grande' }).click();
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  await site.getByRole('button', { name: /^Ver pedido/ }).click();
  const dialog = site.getByRole('dialog', { name: 'Tu pedido' });
  // Una sola forma de entrega: no se elige. El mínimo ($100) impide enviar $70.
  await expect(dialog.getByText('Envío a domicilio', { exact: true })).toBeVisible();
  await dialog.getByLabel('Dirección de entrega').fill('Calle 5 #10');
  await expect(dialog.getByText('El pedido mínimo es de $100: te faltan $30.')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' })).toHaveCount(0);
  await dialog.getByRole('group', { name: 'Cantidad de Smoothie E2E (Grande)' }).getByRole('button', { name: 'Uno más' }).click();
  await dialog.getByRole('radio', { name: 'Efectivo' }).check();
  // Cupón creado en el panel (se guarda en mayúsculas): 10 % de los productos.
  await dialog.getByLabel('¿Tienes un cupón?').fill('E2E10');
  await dialog.getByRole('button', { name: 'Aplicar' }).click();
  const href = await dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).getAttribute('href');
  const text = new URL(href!).searchParams.get('text')!;
  expect(text).toContain('• 2 × Smoothie E2E (Grande) — $140\n\nSubtotal: $140\nCupón E2E10: −$14\nEnvío: $25\nTotal: $151\nEntrega: A domicilio\nDirección: Calle 5 #10\nPago: Efectivo');
  await visitor.close();
});

test('oferta con fecha de fin: vencida vuelve al precio normal; vigente dice hasta cuándo', async ({ page, browser }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Galleta E2E');
  await page.getByRole('textbox', { name: 'Precio', exact: true }).fill('20');
  await page.getByRole('textbox', { name: 'Precio anterior' }).fill('30');
  await page.getByRole('textbox', { name: 'Oferta hasta (opcional)' }).fill('2020-01-31');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);
  const editUrl = page.url();

  await page.goto('/dashboard/catalog/products');
  await expect(page.getByRole('listitem').filter({ hasText: 'Galleta E2E' }).getByText('Oferta vencida')).toBeVisible();
  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  await site.goto(`/catalogo/${slug}/p/galleta-e2e`);
  await expect(site.getByRole('heading', { level: 1, name: 'Galleta E2E' })).toBeVisible();
  await expect(site.getByText('$30')).toHaveCount(0);

  await page.goto(editUrl);
  await page.getByRole('textbox', { name: 'Oferta hasta (opcional)' }).fill('2099-12-31');
  // Arriba y en la barra inferior: los dos guardan el mismo formulario.
  await page.getByRole('button', { name: 'Guardar', exact: true }).first().click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();
  await site.reload();
  await expect(site.getByText('$30').first()).toBeVisible();
  await expect(site.getByText('Oferta hasta el 31 de diciembre')).toBeVisible();
  await visitor.close();
});

test('pausar pedidos: el visitante ve el aviso y no puede enviar; al quitarla, vuelve a poder', async ({ page, browser }) => {
  await page.goto('/dashboard/settings/contacto');
  await page.getByRole('switch', { name: /Pausar pedidos/ }).click();
  await page.getByRole('textbox', { name: 'Mensaje (opcional)' }).fill('Volvemos el lunes.');
  await page.getByRole('button', { name: 'Guardar pedidos' }).click();
  await expect(page.getByText('Configuración guardada')).toBeVisible();

  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  await site.goto(`/catalogo/${slug}/p/croissant-e2e`);
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  const dialog = site.getByRole('dialog', { name: 'Tu pedido' });
  await expect(async () => {
    await site.reload();
    await site.getByRole('button', { name: /^Ver pedido/ }).click();
    await expect(dialog.getByText('Por ahora no estamos recibiendo pedidos. Volvemos el lunes.')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' })).toHaveCount(0);

  await page.getByRole('switch', { name: /Pausar pedidos/ }).click();
  const save = page.getByRole('button', { name: 'Guardar pedidos' });
  await save.click();
  // Guardado = el formulario queda sin cambios pendientes.
  await expect(save).toBeDisabled();
  // La página pública se regenera tras guardar (puede servir una vez la copia anterior).
  await expect(async () => {
    await site.reload();
    await site.getByRole('button', { name: /^Ver pedido/ }).click();
    await expect(dialog.getByText('Por ahora no estamos recibiendo pedidos.', { exact: false })).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await dialog.getByLabel('Dirección de entrega').fill('Calle 5 #10');
  await expect(dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' })).toBeVisible();
  await visitor.close();
});

test('existencias y dieta creadas en el panel: «¡Quedan 2!», tope en el pedido y etiqueta en la ficha', async ({ page, browser }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Pay E2E');
  await page.getByRole('textbox', { name: 'Precio', exact: true }).fill('30');
  await page.getByRole('textbox', { name: 'Existencias (opcional)' }).fill('2');
  await page.getByRole('button', { name: 'Vegano' }).click();
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);

  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  await site.goto(`/catalogo/${slug}/p/pay-e2e`);
  await expect(site.getByText('¡Quedan 2!')).toBeVisible();
  await expect(site.getByRole('list', { name: 'Dieta' }).getByText('Vegano')).toBeVisible();
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  const stepper = site.getByRole('group', { name: 'Cantidad de Pay E2E' });
  await stepper.getByRole('button', { name: 'Uno más' }).click();
  await expect(stepper.getByRole('button', { name: 'Uno más' })).toBeDisabled();
  await visitor.close();

  await page.goto('/dashboard/catalog/products');
  await expect(page.getByRole('listitem').filter({ hasText: 'Pay E2E' }).getByText('Quedan 2')).toBeVisible();
});

test('importar con enlaces de fotos: avisa cuáles no se pudieron descargar', async ({ page }) => {
  await page.goto('/dashboard/catalog/products');
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar desde CSV' });
  // Dominio .invalid: nunca resuelve, así la prueba no sale a internet.
  const csv = ['nombre,precio,imagenes', 'Pan de muerto E2E,40,https://fotos.invalid/pan.jpg', 'Concha E2E,20,foto.jpg'].join('\n');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'fotos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(dialog.getByText('Línea 3: Las imágenes deben ser enlaces que empiecen con http:// o https://.')).toBeVisible();
  await expect(dialog.getByText('Al terminar se descargan las fotos de 1 fila (sólo si ese ítem aún no tiene fotos).')).toBeVisible();
  await dialog.getByRole('button', { name: 'Importar 1' }).click();
  await expect(dialog.getByText('Fotos listas: 0 agregadas.')).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText('Pan de muerto E2E: https://fotos.invalid/pan.jpg')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByText('Pan de muerto E2E')).toBeVisible();
});

test('kit para compartir, rendimiento por producto y nuevas revisiones', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Kit para compartir' }).click();
  const kit = page.getByRole('dialog', { name: 'Kit para compartir tu catálogo' });
  await expect(kit.getByRole('img', { name: /Imagen para historias/ })).toBeVisible();
  await expect(kit.getByRole('textbox', { name: 'Para la bio de Instagram o TikTok' })).toHaveValue(new RegExp(`^Haz tu pedido aquí: https?://.+/catalogo/${slug}$`));
  const download = page.waitForEvent('download');
  await kit.getByRole('button', { name: 'Descargar imagen' }).click();
  expect((await download).suggestedFilename()).toBe(`historia-${slug}.png`);
  await kit.getByRole('button', { name: 'Cerrar' }).click();

  // Nueva revisión del inicio: productos sin descripción.
  await expect(page.getByRole('main').getByText(/\d+ sin descripción: unas líneas ayudan a decidir\./)).toBeVisible();

  // Lista con visitas y pedidos de 30 días; "Más vistos" pone primero el croissant (lo vieron los visitantes de las pruebas).
  await page.goto('/dashboard/catalog/products');
  await page.getByRole('combobox', { name: 'Ordenar' }).selectOption('views');
  await expect(page.getByRole('main').getByRole('listitem').first()).toContainText(productName);
  await expect(page.getByRole('group', { name: new RegExp(`\\d+ visitas y \\d+ unidades pedidas en 30 días`) }).first()).toBeVisible();
});

test('edición rápida: crear desde fotos, precio en la lista y deshacer al eliminar', async ({ page }) => {
  // Una foto real (PNG de 64 × 64): el navegador la procesa y la sube como cualquier otra.
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#c08040' } }).png().toBuffer();
  await page.goto('/dashboard/catalog/products');
  await page.getByRole('button', { name: 'Crear desde fotos' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear productos desde fotos' });
  await dialog.locator('input[type=file]').setInputFiles([
    { name: 'tarta-de-queso.png', mimeType: 'image/png', buffer: png },
    { name: 'IMG_1234.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(dialog.getByRole('textbox', { name: 'Nombre para la foto 1' })).toHaveValue('Tarta de queso');
  // La de la cámara no trae un nombre útil: hay que escribirlo.
  await expect(dialog.getByRole('button', { name: 'Crear 2 ítems' })).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Nombre para la foto 2' }).fill('Brownie E2E');
  await dialog.getByRole('button', { name: 'Crear 2 ítems' }).click();
  await expect(page.getByText('Se crearon 2 ítems')).toBeVisible({ timeout: 20_000 });
  const tarta = page.getByRole('listitem').filter({ hasText: 'Tarta de queso' });
  await expect(tarta.getByRole('switch', { name: 'Visible en el catálogo' })).not.toBeChecked(); // ocultos hasta completarlos
  await expect(tarta.getByRole('img')).toBeVisible();

  // Precio en la lista: clic, escribir y Enter.
  await tarta.getByRole('button', { name: /^Cambiar el precio de Tarta de queso/ }).click();
  await tarta.getByRole('textbox', { name: 'Precio de Tarta de queso' }).fill('1,250.50');
  await tarta.getByRole('textbox', { name: 'Precio de Tarta de queso' }).press('Enter');
  await expect(page.getByText('Precio actualizado')).toBeVisible();
  await expect(tarta.getByText('$1,250.50')).toBeVisible();

  // Eliminar y deshacer.
  await page.getByRole('button', { name: 'Acciones de Brownie E2E' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByText('"Brownie E2E" eliminado')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Brownie E2E' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Ítem restaurado')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Brownie E2E' })).toBeVisible();
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

test('editor del sitio: deshacer y rehacer con botones y con el teclado', async ({ page }) => {
  await page.goto('/dashboard/sitio');
  const save = page.getByRole('button', { name: 'Guardar cambios' });
  // El sitio inicial puede venir sin guardar: se guarda para partir de un estado limpio.
  if (await save.isEnabled()) {
    await save.click();
    await expect(save).toBeDisabled();
  }
  const history = page.getByRole('group', { name: 'Historial de cambios' });
  const undo = history.getByRole('button', { name: 'Deshacer' });
  const redo = history.getByRole('button', { name: 'Rehacer' });
  const pending = page.getByText('Cambios sin guardar');
  const firstToggle = page.getByRole('button', { name: 'Visibilidad' }).first();
  await expect(undo).toBeDisabled();

  await firstToggle.click();
  await expect(firstToggle.locator('svg.lucide-eye-off')).toHaveCount(1);
  await expect(pending).toBeVisible();

  await undo.click();
  await expect(firstToggle.locator('svg.lucide-eye')).toHaveCount(1);
  // Volver a lo guardado deja el editor limpio.
  await expect(pending).toHaveCount(0);
  await expect(save).toBeDisabled();
  await expect(redo).toBeEnabled();

  await page.keyboard.press('Control+Shift+z');
  await expect(firstToggle.locator('svg.lucide-eye-off')).toHaveCount(1);
  await expect(pending).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(firstToggle.locator('svg.lucide-eye')).toHaveCount(1);
  await expect(pending).toHaveCount(0);
});

test('reseñas: el visitante opina, el negocio la aprueba y se publica con su calificación', async ({ page, browser }) => {
  await page.goto('/dashboard/resenas');
  const main = page.getByRole('main');
  await expect(main.getByText('No hay reseñas por revisar.')).toBeVisible();
  await main.getByRole('switch', { name: 'Pedir opiniones en la ficha de cada producto' }).click();
  await expect(main.getByRole('switch', { name: 'Pedir opiniones en la ficha de cada producto' })).toBeChecked();

  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  const reviews = site.getByRole('region', { name: 'Opiniones' });
  // La página pública se regenera tras activar las reseñas.
  await expect(async () => {
    await site.goto(`/catalogo/${slug}/p/croissant-e2e`);
    await expect(reviews.getByText('Todavía no hay opiniones. ¡Sé el primero!')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await reviews.getByRole('button', { name: 'Deja tu opinión' }).click();
  await reviews.getByRole('radio', { name: '4 de 5 estrellas' }).check();
  await reviews.getByLabel('Tu nombre').fill('Ana E2E');
  await reviews.getByLabel('Comentario (opcional)').fill('Crujiente y recién hecho.');
  const sent = site.waitForResponse((response) => response.url().endsWith('/api/reviews'));
  await reviews.getByRole('button', { name: 'Enviar opinión' }).click();
  expect(await (await sent).json()).toEqual({ ok: true });
  await expect(reviews.getByRole('status')).toHaveText('¡Gracias! Tu opinión se publicará cuando el negocio la apruebe.');

  // Pendiente: no se publica todavía; el inicio del panel avisa.
  await site.reload();
  await expect(reviews.getByText('Ana E2E')).toHaveCount(0);
  await page.goto('/dashboard');
  await expect(page.getByRole('main').getByText('Tienes 1 reseña nueva por revisar.')).toBeVisible();

  await page.goto('/dashboard/resenas');
  const item = main.getByRole('listitem').filter({ hasText: 'Ana E2E' });
  await expect(item.getByText('Sobre Croissant E2E')).toBeVisible();
  await expect(item.getByText('Crujiente y recién hecho.')).toBeVisible();
  await item.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Reseña publicada')).toBeVisible();
  await expect(main.getByText('No hay reseñas por revisar.')).toBeVisible();
  await main.getByRole('tab', { name: 'Publicadas' }).click();
  await expect(main.getByRole('listitem').filter({ hasText: 'Ana E2E' })).toBeVisible();

  await expect(async () => {
    await site.reload();
    await expect(reviews.getByText('Ana E2E')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(reviews.getByText('1 opinión')).toBeVisible();
  const ld = JSON.parse((await site.locator('script[type="application/ld+json"]').first().textContent())!);
  expect(ld[0].aggregateRating).toMatchObject({ ratingValue: 4, reviewCount: 1 });
  await visitor.close();
});

test('días especiales y zonas de entrega del panel llegan al sitio y al pedido', async ({ page, browser }) => {
  await page.goto('/dashboard/settings/contacto');
  // El día especial nuevo propone mañana: cerrado, con su motivo.
  await page.getByRole('button', { name: 'Agregar día especial' }).click();
  const special = page.getByRole('list', { name: 'Días especiales' }).getByRole('listitem').first();
  await special.getByLabel('Motivo (opcional)').fill('Inventario E2E');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('Contacto guardado')).toBeVisible();

  await page.getByRole('button', { name: 'Agregar zona' }).click();
  await page.getByRole('button', { name: 'Agregar zona' }).click();
  const zones = page.getByRole('list', { name: 'Zonas de entrega' }).getByRole('listitem');
  await zones.nth(0).getByLabel('Zona', { exact: true }).fill('Centro');
  await zones.nth(0).getByLabel('Envío', { exact: true }).fill('20');
  await zones.nth(1).getByLabel('Zona', { exact: true }).fill('Norte');
  await zones.nth(1).getByLabel('Pedido mínimo').fill('500');
  await page.getByRole('button', { name: 'Guardar pedidos' }).click();
  await expect(page.getByText('Configuración guardada')).toBeVisible();

  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  await expect(async () => {
    await site.goto(`/catalogo/${slug}`);
    await expect(site.getByText(/Cerrado · Inventario E2E/).first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  expect(await site.content()).toContain('specialOpeningHoursSpecification');

  await site.goto(`/catalogo/${slug}/p/smoothie-e2e`);
  await site.getByRole('radio', { name: 'Grande' }).click();
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  await site.getByRole('button', { name: /^Ver pedido/ }).click();
  const dialog = site.getByRole('dialog', { name: 'Tu pedido' });
  await dialog.getByRole('group', { name: 'Cantidad de Smoothie E2E (Grande)' }).getByRole('button', { name: 'Uno más' }).click();
  await dialog.getByLabel('Dirección de entrega').fill('Calle 5 #10');
  await expect(dialog.getByText('Elige tu zona de entrega.')).toBeVisible();
  const zone = dialog.getByLabel('Zona de entrega');
  await zone.selectOption('Norte');
  await expect(dialog.getByText('El pedido mínimo es de $500: te faltan $360.')).toBeVisible();
  await zone.selectOption('Centro');
  const href = await dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).getAttribute('href');
  const text = new URL(href!).searchParams.get('text')!;
  expect(text).toContain('Subtotal: $140\nEnvío: $20\nTotal: $160\nEntrega: A domicilio\nZona: Centro\nDirección: Calle 5 #10');
  await visitor.close();
});

test('mayoreo y pedidos en mesa configurados en el panel llegan a la ficha y al pedido', async ({ page, browser }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Galleta mayoreo E2E');
  await page.getByRole('textbox', { name: 'Precio', exact: true }).fill('10');
  await page.getByRole('button', { name: 'Agregar precio por mayoreo' }).click();
  const tier = page.getByRole('list', { name: 'Precios por mayoreo' }).getByRole('listitem').first();
  await tier.getByLabel('Desde (piezas)').fill('12');
  await tier.getByLabel('Precio c/u').fill('8');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);

  await page.goto('/dashboard/settings/contacto');
  await page.getByRole('switch', { name: /Pedidos en mesa/ }).click();
  await expect(page.getByText(new RegExp(`Cada código abre .*/catalogo/${slug}\\?mesa=1$`))).toBeVisible();
  await page.getByRole('button', { name: 'Guardar pedidos' }).click();
  await expect(page.getByText('Configuración guardada')).toBeVisible();

  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  await expect(async () => {
    await site.goto(`/catalogo/${slug}/p/galleta-mayoreo-e2e?mesa=7`);
    await expect(site.getByRole('list', { name: 'Precio por mayoreo' })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await site.getByRole('button', { name: 'Agregar al pedido' }).click();
  await site.getByRole('button', { name: /^Ver pedido/ }).click();
  const dialog = site.getByRole('dialog', { name: 'Tu pedido' });
  // La configuración de pedidos de la ficha puede venir de la copia anterior: se espera a la mesa.
  await expect(async () => {
    await site.reload();
    await site.getByRole('button', { name: /^Ver pedido/ }).click();
    await expect(dialog.getByText('Pedido para la mesa 7')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  const qty = dialog.getByRole('group', { name: 'Cantidad de Galleta mayoreo E2E' }).getByRole('spinbutton', { name: 'Cantidad' });
  await qty.fill('12');
  await qty.press('Enter');
  const href = await dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).getAttribute('href');
  const text = new URL(href!).searchParams.get('text')!;
  expect(text).toContain('• 12 × Galleta mayoreo E2E — $96 (mayoreo, $8 c/u)\n\nTotal: $96\nMesa: 7\n');
  await visitor.close();
});

test('temporada, copiar extras de otro producto y «Combínalo con» elegidos en el panel', async ({ page, browser }) => {
  await page.goto('/dashboard/catalog/items/new?type=product');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Rosca E2E');
  await page.getByRole('textbox', { name: 'Precio', exact: true }).fill('300');
  await page.getByLabel('Visible desde').fill('2099-01-01');
  await page.getByRole('button', { name: 'Copiar de…' }).last().click();
  await page.getByRole('menu', { name: 'Copiar los extras de otro producto' }).getByRole('menuitem', { name: /Bowl E2E/ }).click();
  await expect(page.getByRole('list', { name: 'Extras' }).getByRole('textbox', { name: 'Extra' }).first()).toHaveValue('Granola');
  await page.getByRole('combobox', { name: 'Productos sugeridos' }).click();
  await page.getByRole('option', { name: 'Croissant E2E' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/catalog\/items\/[0-9a-f-]{36}$/);
  const editUrl = page.url();

  await page.goto('/dashboard/catalog/products');
  await expect(page.getByRole('listitem').filter({ hasText: 'Rosca E2E' }).getByText('Se verá desde el 1 de enero')).toBeVisible();
  const visitor = await browser.newContext(ANONYMOUS);
  const site = await visitor.newPage();
  expect((await site.goto(`/catalogo/${slug}/p/rosca-e2e`))?.status()).toBe(404);

  // Sin fecha de inicio: ya se ve, con los extras copiados y lo elegido para combinar.
  await page.goto(editUrl);
  await page.getByLabel('Visible desde').filter({ visible: true }).fill('');
  await page.getByRole('button', { name: 'Guardar', exact: true }).first().click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();
  await expect(async () => {
    const response = await site.goto(`/catalogo/${slug}/p/rosca-e2e`);
    expect(response?.status()).toBe(200);
  }).toPass({ timeout: 15_000 });
  await expect(site.getByRole('group', { name: /Toppings/ }).getByRole('checkbox', { name: /Granola/ })).toBeVisible();
  const pairs = site.getByRole('region', { name: 'Combínalo con' });
  await expect(pairs.getByRole('heading', { name: 'Croissant E2E' })).toBeVisible();
  await visitor.close();
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
