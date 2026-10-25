import { expect, test } from '@playwright/test';

test('el panel se puede instalar: manifest, ícono y service worker de los avisos', async ({ request }) => {
  const manifest = await request.get('/panel.webmanifest');
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()['content-type']).toContain('application/manifest+json');
  expect(await manifest.json()).toMatchObject({ start_url: '/dashboard', scope: '/dashboard', display: 'standalone', icons: expect.arrayContaining([expect.objectContaining({ src: '/panel-icon', sizes: '512x512' })]) });

  const icon = await request.get('/panel-icon');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toBe('image/png');

  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  expect(sw.headers()['cache-control']).toContain('no-cache');
  expect(await sw.text()).toContain("addEventListener('push'");
});
