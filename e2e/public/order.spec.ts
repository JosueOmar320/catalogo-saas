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

    // La demo entrega a domicilio o en el local: hay que elegir, y a domicilio pide la dirección.
    const send = dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' });
    await expect(send).toHaveCount(0);
    await expect(dialog.getByText('Elige cómo quieres recibir tu pedido.')).toBeVisible();
    await dialog.getByRole('radio', { name: 'Envío a domicilio' }).check();
    await expect(dialog.getByText('Escribe la dirección de entrega.')).toBeVisible();
    await expect(dialog.getByText('Te faltan $138 para el envío gratis.')).toBeVisible();
    await expect(dialog.getByText('$197')).toBeVisible(); // 162 + 35 de envío
    await dialog.getByLabel('Dirección de entrega').fill('Av. Juárez 12, Centro');
    await dialog.getByRole('radio', { name: 'Efectivo' }).check();
    await dialog.getByLabel('Tu nombre (opcional)').fill('Ana');
    await dialog.getByLabel('Nota (opcional)').fill('Sin azúcar');

    const text = await whatsappMessage(page);
    expect(text).toMatch(
      new RegExp(
        [
          '^Hola Café Aurora, quiero hacer este pedido:',
          '',
          '• 2 × Espresso doble \\(CAF-001\\) — \\$90',
          '• 1 × Cold brew \\(CAF-003\\) — \\$72',
          '',
          'Subtotal: \\$162',
          'Envío: \\$35',
          'Total: \\$197',
          'Entrega: A domicilio',
          'Dirección: Av\\. Juárez 12, Centro',
          'Pago: Efectivo',
          'Nombre: Ana',
          'Nota: Sin azúcar',
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

  test('un producto con opciones se elige en la ficha y cada opción es una línea del pedido', async ({ page }) => {
    await page.goto('/demo/menu');
    const latte = card(page, 'Latte de avena');
    await expect(latte).toContainText('desde');
    await expect(latte).toContainText('$68');
    // En la tarjeta no se agrega directo: lleva a la ficha para elegir.
    await expect(latte.getByRole('button', { name: 'Agregar al pedido' })).toHaveCount(0);
    await latte.getByRole('link', { name: 'Elegir opción' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Latte de avena' })).toBeVisible();
    const sizes = page.getByRole('radiogroup', { name: /Tamaño/ });
    await expect(sizes.getByRole('radio', { name: '12 oz' })).toHaveAttribute('aria-checked', 'true');
    await sizes.getByRole('radio', { name: '16 oz' }).click();
    await expect(sizes.getByRole('radio', { name: '16 oz' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('$78', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar al pedido' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();
    await expect(page.getByRole('group', { name: 'Cantidad de Latte de avena (16 oz)' })).toBeVisible();

    await sizes.getByRole('radio', { name: '12 oz' }).click();
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();
    await expect(orderButton(page)).toContainText('$146');

    await orderButton(page).click();
    await page.getByRole('dialog', { name: 'Tu pedido' }).getByRole('radio', { name: 'Recoger en el local' }).check();
    const text = await whatsappMessage(page);
    expect(text).toContain('Entrega: Recoger en el local');
    expect(text).toContain('• 1 × Latte de avena (16 oz) (CAF-002) — $78');
    expect(text).toContain('• 1 × Latte de avena (12 oz) (CAF-002) — $68');
  });

  test('horario: el sitio dice si está abierto y el pedido avisa cuando está cerrado', async ({ page }) => {
    // Lunes 19 de octubre de 2026, 22:00 en Ciudad de México (la demo abre de 7:30 a 20:00).
    await page.clock.setFixedTime(new Date('2026-10-20T04:00:00Z'));
    await page.goto('/demo/contacto');
    const main = page.getByRole('main');
    await expect(main.getByText('Cerrado · abre mañana a las 7:30').first()).toBeVisible();
    await expect(main.getByText(/lun\.? – vie\.?: 7:30 – 20:00/).first()).toBeVisible();

    await page.goto('/demo');
    await card(page, 'Espresso doble').getByRole('button', { name: 'Agregar al pedido' }).click();
    await orderButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Tu pedido' });
    await expect(dialog.getByText('Cerrado · abre mañana a las 7:30. Puedes enviar tu pedido y te respondemos al abrir.')).toBeVisible();
    // Avisa, pero no impide pedir.
    await dialog.getByRole('radio', { name: 'Recoger en el local' }).check();
    await expect(dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' })).toBeVisible();

    // Lunes 9:00: abierto.
    await page.clock.setFixedTime(new Date('2026-10-19T15:00:00Z'));
    await page.goto('/demo/contacto');
    await expect(main.getByText('Abierto ahora · cierra a las 20:00').first()).toBeVisible();
  });

  test('cupón de descuento: uno que no existe avisa; el válido descuenta de los productos', async ({ page }) => {
    await page.goto('/demo');
    await card(page, 'Espresso doble').getByRole('button', { name: 'Agregar al pedido' }).click();
    await card(page, 'Cold brew').getByRole('button', { name: 'Agregar al pedido' }).click();
    await orderButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Tu pedido' });
    const field = dialog.getByLabel('¿Tienes un cupón?');
    await field.fill('NOEXISTE');
    await dialog.getByRole('button', { name: 'Aplicar' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Ese cupón no existe o ya no está activo.');
    // Mayúsculas o minúsculas da igual; el código no está en la página.
    expect(await page.content()).not.toContain('BIENVENIDA');
    await field.fill('bienvenida');
    await field.press('Enter');
    await expect(dialog.getByText('Cupón BIENVENIDA aplicado')).toBeVisible();
    await expect(dialog.getByText('−$11.70')).toBeVisible(); // 10 % de $117
    await dialog.getByRole('radio', { name: 'Recoger en el local' }).check();
    const text = await whatsappMessage(page);
    expect(text).toContain('Subtotal: $117\nCupón BIENVENIDA: −$11.70\nTotal: $105.30\nEntrega: Recoger en el local');

    await dialog.getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(dialog.getByLabel('¿Tienes un cupón?')).toBeVisible();
    expect(await whatsappMessage(page)).toContain('Total: $117');
  });

  test('barra de anuncios: enlaza, se cierra y se recuerda', async ({ page }) => {
    await page.goto('/demo');
    const bar = page.getByRole('region', { name: 'Anuncio' });
    await expect(bar).toContainText('Envío gratis en pedidos desde $300');
    await bar.getByRole('link', { name: 'Ver el menú' }).click();
    await expect(page).toHaveURL(/\/demo\/menu$/);
    await page.getByRole('region', { name: 'Anuncio' }).getByRole('button', { name: 'Cerrar anuncio' }).click();
    await expect(page.getByRole('region', { name: 'Anuncio' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Nuestro menú' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Anuncio' })).toHaveCount(0);
  });

  test('"¿Agregas algo más?" suma un producto con un toque', async ({ page }) => {
    await page.goto('/demo');
    await card(page, 'Espresso doble').getByRole('button', { name: 'Agregar al pedido' }).click();
    await orderButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Tu pedido' });
    const more = dialog.getByRole('region', { name: '¿Agregas algo más?' });
    // Lo que ya está en el pedido no se sugiere.
    await expect(more.getByRole('button', { name: 'Agregar Espresso doble' })).toHaveCount(0);
    const first = more.getByRole('button').first();
    const name = (await first.getAttribute('aria-label'))!.replace(/^Agregar /, '');
    await first.click();
    await expect(dialog.getByRole('group', { name: `Cantidad de ${name}` })).toBeVisible();
    await expect(orderButton(page)).toContainText('2');
  });

  test('repetir el último pedido enviado y precios al día en un pedido guardado', async ({ page, context }) => {
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'WhatsApp' }));
    await page.goto('/demo');
    await card(page, 'Croissant de mantequilla').getByRole('button', { name: 'Agregar al pedido' }).click();
    await orderButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Tu pedido' });
    await dialog.getByRole('radio', { name: 'Recoger en el local' }).check();
    const popup = context.waitForEvent('page');
    await dialog.getByRole('link', { name: 'Enviar pedido por WhatsApp' }).click();
    await (await popup).close();
    await dialog.getByRole('button', { name: 'Vaciar pedido' }).click();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Repetir mi último pedido' }).click();
    await expect(dialog.getByRole('group', { name: 'Cantidad de Croissant de mantequilla' })).toBeVisible();
    await expect(orderButton(page)).toContainText('$48');

    // Un pedido guardado con un precio viejo y un producto que ya no existe.
    const espresso = '00000000-0000-4000-8000-000000000100';
    await page.evaluate((id) => {
      const line = { id, name: 'Espresso doble', sku: null, price: 10, priceLabel: '$10', currency: 'MXN', url: '', image: null, qty: 1 };
      localStorage.setItem('order:demo', JSON.stringify({ lines: [line, { ...line, id: '00000000-0000-4000-8000-0000000009ff', name: 'Producto viejo' }] }));
    }, espresso);
    await page.reload();
    await expect(orderButton(page)).toContainText('$45');
    await orderButton(page).click();
    await expect(dialog.getByText('Ya no están disponibles y se quitaron del pedido: Producto viejo.')).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Cantidad de Producto viejo' })).toHaveCount(0);
  });

  test('extras en la ficha: se suman al precio, respetan el máximo y van en el nombre de la línea', async ({ page }) => {
    await page.goto('/demo/p/ejemplo-2');
    await page.getByRole('radio', { name: '16 oz' }).click();
    const extras = page.getByRole('group', { name: /Extras/ });
    await extras.getByRole('checkbox', { name: /Shot extra/ }).check();
    await extras.getByRole('checkbox', { name: /Canela/ }).check();
    await expect(page.getByText('$90', { exact: true })).toBeVisible(); // 78 + 12 + 0
    // Máximo 2: el tercero queda deshabilitado.
    await expect(extras.getByRole('checkbox', { name: /Leche de almendra/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Agregar al pedido' }).click();
    await expect(page.getByRole('group', { name: 'Cantidad de Latte de avena (16 oz) + Shot extra, Canela' })).toBeVisible();

    await orderButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Tu pedido' });
    await dialog.getByRole('button', { name: 'Agregar nota' }).click();
    await dialog.getByRole('textbox', { name: 'Nota para Latte de avena (16 oz) + Shot extra, Canela' }).fill('poca espuma');
    await dialog.getByRole('radio', { name: 'Recoger en el local' }).check();
    const text = await whatsappMessage(page);
    expect(text).toContain('• 1 × Latte de avena (16 oz) + Shot extra, Canela (CAF-002) — $90\n   Nota: poca espuma');
  });

  test('un producto con horario sólo se agrega dentro de ese horario', async ({ page }) => {
    // 15:00 en Ciudad de México: el pan de masa madre se pide de 8:00 a 13:00.
    await page.clock.setFixedTime(new Date('2026-10-19T21:00:00Z'));
    await page.goto('/demo/menu');
    const bread = card(page, 'Pan de masa madre');
    await expect(bread.getByRole('button', { name: 'Se pide de 8:00 a 13:00' })).toBeDisabled();
    // 9:00: ya se puede.
    await page.clock.setFixedTime(new Date('2026-10-19T15:00:00Z'));
    await page.reload();
    await card(page, 'Pan de masa madre').getByRole('button', { name: 'Agregar al pedido' }).click();
    await expect(orderButton(page)).toContainText('$120');
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
    await page.getByRole('dialog', { name: 'Tu pedido' }).getByRole('radio', { name: 'Recoger en el local' }).check();
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
