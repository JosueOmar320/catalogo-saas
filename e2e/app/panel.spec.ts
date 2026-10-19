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
  const href = await dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).getAttribute('href');
  const text = new URL(href!).searchParams.get('text')!;
  expect(text).toContain('• 2 × Smoothie E2E (Grande) — $140\n\nSubtotal: $140\nEnvío: $25\nTotal: $165\nEntrega: A domicilio\nDirección: Calle 5 #10\nPago: Efectivo');
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
