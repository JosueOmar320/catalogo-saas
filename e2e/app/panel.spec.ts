import { expect, test } from '@playwright/test';
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
