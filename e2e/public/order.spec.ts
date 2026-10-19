import { expect, test, type Page } from '@playwright/test';

/**
 * Pedido por WhatsApp en la demo (Café Aurora, WhatsApp +52 55 1234 5678).
 * El pedido vive en localStorage: cada prueba arranca con un contexto limpio.
 */
const card = (page: Page, name: string) => page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) }).first();
const orderButton = (page: Page) => page.getByRole('button', { name: /^Ver pedido/ });

/** Texto del mensaje que abrirá WhatsApp (parámetro text del enlace wa.me). */
async function whatsappMessage(page: Page) {
  const href = await page.getByRole('dialog', { name: 'Tu pedido' }).getByRole('link', { name: 'Enviar pedido por WhatsApp' }).getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/525512345678\?text=/);
  return new URL(href!).searchParams.get('text');
}

test.describe('Pedido por WhatsApp', () => {
  test('arma el pedido con cantidades y genera el mensaje', async ({ page }) => {
    await page.goto('/demo');
    await expect(orderButton(page)).toHaveCount(0);

    await card(page, 'Espresso doble').getByRole('button', { name: 'Agregar al pedido' }).click();
    // El botón se convierte en selector de cantidad.
    await expect(card(page, 'Espresso doble').getByRole('group', { name: 'Cantidad de Espresso doble' })).toBeVisible();
    await card(page, 'Cold brew').getByRole('button', { name: 'Agregar al pedido' }).click();

    await expect(orderButton(page)).toContainText('2');
    await expect(orderButton(page)).toContainText('$117');

    await orderButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Tu pedido' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('group', { name: 'Cantidad de Espresso doble' }).getByRole('button', { name: 'Uno más' }).click();
    await expect(dialog.getByText('$162')).toBeVisible();
    await dialog.getByLabel('Tu nombre (opcional)').fill('Ana');
    await dialog.getByLabel('Nota (opcional)').fill('Para llevar');

    const text = await whatsappMessage(page);
    expect(text).toMatch(
      new RegExp(
        [
          '^Hola Café Aurora, quiero hacer este pedido:',
          '',
          '• 2 × Espresso doble \\(CAF-001\\) — \\$90',
          '• 1 × Cold brew \\(CAF-003\\) — \\$72',
          '',
          'Total: \\$162',
          'Nombre: Ana',
          'Nota: Para llevar',
          '',
          'Pedido desde https?://.+/demo$',
        ].join('\n'),
      ),
    );
  });

  test('el pedido se conserva al recargar y se puede vaciar', async ({ page }) => {
    await page.goto('/demo');
    await card(page, 'Croissant de mantequilla').getByRole('button', { name: 'Agregar al pedido' }).click();
    await expect(orderButton(page)).toContainText('$48');

    await page.reload();
    await expect(orderButton(page)).toContainText('$48');
    await expect(card(page, 'Croissant de mantequilla').getByRole('group', { name: 'Cantidad de Croissant de mantequilla' })).toBeVisible();

    await orderButton(page).click();
    await page.getByRole('dialog', { name: 'Tu pedido' }).getByRole('button', { name: 'Vaciar pedido' }).click();
    await expect(page.getByText('Tu pedido está vacío. Agrega productos desde el catálogo.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(orderButton(page)).toHaveCount(0);
  });

  test('quitar la última unidad saca el producto del pedido', async ({ page }) => {
    await page.goto('/demo');
    const espresso = card(page, 'Espresso doble');
    await espresso.getByRole('button', { name: 'Agregar al pedido' }).click();
    await espresso.getByRole('button', { name: 'Quitar del pedido' }).click();
    await expect(espresso.getByRole('button', { name: 'Agregar al pedido' })).toBeVisible();
    await expect(orderButton(page)).toHaveCount(0);
  });

  test('el panel se cierra con Escape y con clic fuera', async ({ page }) => {
    await page.goto('/demo');
    await card(page, 'Espresso doble').getByRole('button', { name: 'Agregar al pedido' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tu pedido' });

    await orderButton(page).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await orderButton(page).click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });

  test('la ficha del producto permite agregar y conserva la consulta como secundaria', async ({ page }) => {
    await page.goto('/demo/p/ejemplo-1');
    await expect(page.getByRole('heading', { level: 1, name: 'Espresso doble' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Consultar por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/525512345678/);

    await page.getByRole('button', { name: 'Agregar al pedido' }).click();
    await expect(page.getByRole('group', { name: 'Cantidad de Espresso doble' })).toBeVisible();
    await expect(orderButton(page)).toContainText('$45');
  });

  test('los servicios y los productos agotados no se agregan al pedido', async ({ page }) => {
    await page.goto('/demo/menu');
    await expect(card(page, 'Rol de canela')).toBeVisible();
    await expect(card(page, 'Rol de canela').getByRole('button', { name: 'Agregar al pedido' })).toHaveCount(0);
    await page.goto('/demo/p/ejemplo-9');
    await expect(page.getByRole('heading', { level: 1, name: 'Taller de barismo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar al pedido' })).toHaveCount(0);
  });

  test('la demo no cuenta pedidos (sólo el sitio publicado avisa al servidor)', async ({ page, context }) => {
    const beacons: string[] = [];
    page.on('request', (request) => request.url().endsWith('/api/orders') && beacons.push(request.url()));
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'WhatsApp' }));
    await page.goto('/demo');
    await card(page, 'Espresso doble').getByRole('button', { name: 'Agregar al pedido' }).click();
    await orderButton(page).click();
    const popup = context.waitForEvent('page');
    await page.getByRole('dialog', { name: 'Tu pedido' }).getByRole('link', { name: 'Enviar pedido por WhatsApp' }).click();
    await (await popup).close();
    await page.waitForTimeout(500);
    expect(beacons).toEqual([]);
  });

  test('la ficha permite compartir y sugiere productos relacionados', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/demo/p/ejemplo-1');
    const share = page.getByRole('group', { name: 'Compartir' });
    await expect(share.getByRole('link', { name: 'Compartir por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=Mira%20esto%3A%20Espresso%20doble%20https?%3A/);
    await share.getByRole('button', { name: 'Copiar enlace' }).click();
    await expect(share.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/p\/ejemplo-1$/);

    const related = page.getByRole('region', { name: 'También te puede interesar' });
    await expect(related.getByRole('article')).toHaveCount(4);
    await expect(related.getByRole('heading', { name: 'Espresso doble', exact: true })).toHaveCount(0);
  });
});
