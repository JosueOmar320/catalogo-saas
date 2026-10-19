import { expect, test, type Page } from '@playwright/test';

// La landing incluye un sitio de ejemplo con su propio h1 ("Café Aurora"): el título es el primero.
const landingTitle = (page: Page) => page.getByRole('heading', { level: 1 }).first();

test.describe('Landing', () => {
  test('se muestra en español por defecto', async ({ page }) => {
    await page.goto('/');
    await expect(landingTitle(page)).toHaveText('Sitio web, catálogo y PDF para tu negocio, sin código');
    await expect(page).toHaveTitle(/Sitio web, catálogo y PDF/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('link', { name: 'Ver la demo en vivo' })).toHaveAttribute('href', '/demo');
  });

  test.describe('con el navegador en inglés', () => {
    test.use({ locale: 'en-US' });

    test('usa el idioma del navegador (Accept-Language)', async ({ page }) => {
      await page.goto('/');
      await expect(landingTitle(page)).toHaveText('Website, catalog and PDF for your business, no code');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test('el selector de idioma cambia y se recuerda al recargar', async ({ page }) => {
    await page.goto('/');
    const english = page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'EN' });
    await english.click();
    await expect(landingTitle(page)).toHaveText('Website, catalog and PDF for your business, no code');
    await expect(page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(landingTitle(page)).toHaveText('Website, catalog and PDF for your business, no code');
  });

  test('la apariencia rota Sistema → Claro → Oscuro y se recuerda', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.getByRole('button', { name: 'Apariencia: Sistema. Cambiar' }).click();
    await page.getByRole('button', { name: 'Apariencia: Claro. Cambiar' }).click();
    await expect(page.getByRole('button', { name: 'Apariencia: Oscuro. Cambiar' })).toBeVisible();
    await expect(html).toHaveClass(/\bdark\b/);

    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/);
  });
});
