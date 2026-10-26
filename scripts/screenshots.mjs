/**
 * Capturas del README (docs/images/*.jpg): el sitio de ejemplo en escritorio y
 * celular, el catálogo y la ficha de un producto. (docs/images/pdf-catalog.jpg son
 * las tres primeras páginas de /demo/pdf?template=catalog, que descarga el PDF.)
 *
 *   node scripts/screenshots.mjs                       (contra producción)
 *   BASE_URL=http://localhost:3000 node scripts/screenshots.mjs
 *
 * Usa el Chromium de Playwright (npx playwright install chromium).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const BASE_URL = (process.env.BASE_URL ?? 'https://catalogo-saas-nu.vercel.app').replace(/\/$/, '');
const OUT = 'docs/images';
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: 'site-home', path: '/demo', viewport: { width: 1440, height: 900 } },
  { name: 'site-menu', path: '/demo/menu', viewport: { width: 1440, height: 900 } },
  { name: 'site-product', path: '/demo/p/ejemplo-1', viewport: { width: 1440, height: 900 } },
  { name: 'site-mobile', path: '/demo/menu', viewport: { width: 390, height: 844 }, mobile: true },
];

const browser = await chromium.launch();
try {
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: shot.viewport,
      deviceScaleFactor: 2,
      isMobile: Boolean(shot.mobile),
      hasTouch: Boolean(shot.mobile),
      locale: 'es-MX',
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'networkidle' });
    // La ventana de bienvenida del sitio de ejemplo tapa el contenido.
    const welcome = page.getByRole('dialog');
    if (await welcome.isVisible().catch(() => false)) await page.keyboard.press('Escape');
    // Contra `next dev`, el indicador de desarrollo no va en la captura.
    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.waitForTimeout(800);
    // JPG de 1600 px de ancho como máximo: livianos para el README y para compartir.
    const png = await page.screenshot();
    await sharp(png).resize({ width: Math.min(1600, shot.viewport.width * 2) }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT}/${shot.name}.jpg`);
    console.log(`✔ ${OUT}/${shot.name}.jpg`);
    await context.close();
  }
} finally {
  await browser.close();
}
